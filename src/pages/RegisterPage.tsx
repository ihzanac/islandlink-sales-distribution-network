import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import {
  Layers, Store, Building2, ChevronRight, ArrowLeft,
  User, Briefcase, Phone, Mail, MapPinned, Lock,
  CheckCircle2, IdCard
} from "lucide-react";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAppSelector } from "../store/hooks";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

// Define the possible steps in the registration process
type RegistrationStep = "role" | "info" | "done";

// Define the possible user roles
type UserRole = "retail-customer" | "rdc-staff";

// Define the structure of a role option
interface RoleOption {
  id: UserRole;
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
}

// Define props for the FormField component
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

// Define props for the IconInputField component
interface IconInputFieldProps {
  id: string;
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  hint?: string;
}

// Define props for the SelectField component
interface SelectFieldProps {
  name?: string;
  placeholder: string;
  children: React.ReactNode;
}

const GOOGLE_MAPS_API_KEY = "AIzaSyCWbUP2jSGJ4lp-Dlh3IOKZkOgXhmfKXnY";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { role: currentRole, uid } = useAppSelector((state) => state.auth);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (uid && currentRole) {
      if (currentRole === 'retail-customer') navigate('/customer-history');
      else if (currentRole === 'rdc-staff') navigate('/delivery-boy');
      else navigate('/dashboard');
    }
  }, [uid, currentRole, navigate]);

  // Track which step the user is on: role selection, filling info, or done
  const [currentStep, setCurrentStep] = useState<RegistrationStep>("role");

  // Store which role the user selected (retail customer or RDC staff)
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");

  // Store any error messages to show to the user
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Store coordinates if picked on map
  const [coordinates, setCoordinates] = useState<{ lat: number, lng: number } | null>(null);

  // Define the two types of users who can register
  const roleOptions: RoleOption[] = [
    {
      id: "retail-customer",
      title: "Retail Customer",
      description: "Retailers, supermarkets and resellers placing FMCG product orders.",
      icon: Store,
      tag: "Self-service ordering",
    },
    {
      id: "rdc-staff",
      title: "RDC Staff",
      description: "Regional distribution centre staff managing stock and deliveries.",
      icon: Building2,
      tag: "Inventory & dispatch",
    },
  ];

  // Get the details of the currently selected role
  const selectedRoleDetails = roleOptions.find(role => role.id === selectedRole);

  // ============================================================
  // Handle form submission - creates user account in Firebase
  // ============================================================
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Stop the form from refreshing the page
    event.preventDefault();

    // Clear any previous error messages
    setErrorMessage("");

    // Get all the form data the user entered
    const formData = new FormData(event.currentTarget);

    // Get email and password (different field names for different roles)
    const email = (formData.get("email") || formData.get("staffEmail")) as string;
    const password = (formData.get("password") || formData.get("staffPassword")) as string;
    const confirmPassword = (formData.get("confirmPassword") || formData.get("staffConfirmPassword")) as string;

    // Get name fields based on role
    const businessName = formData.get("businessName") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    // Create a display name based on role
    let displayName = "";
    if (selectedRole === "retail-customer") {
      displayName = businessName || "Unknown";
    } else {
      displayName = `${firstName || ''} ${lastName || ''}`.trim() || "Unknown";
    }

    // Check if email and password were provided
    if (!email || !password) {
      setErrorMessage("Email and Password are required.");
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      // Create the user account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Prepare user data to save in Firestore database
      const userData: Record<string, any> = {
        uid: user.uid,
        role: selectedRole,
        name: displayName,
        email: email,
        createdAt: new Date().toISOString(),
      };

      // Add coordinates if available
      if (coordinates) {
        userData.lat = coordinates.lat;
        userData.lng = coordinates.lng;
      }

      // Add all form fields to the user data (but exclude passwords for security)
      formData.forEach((value, key) => {
        if (!key.toLowerCase().includes("password")) {
          userData[key] = value;
        }
      });

      // Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), userData);

      // Move to the success/done step
      setCurrentStep("done");

    } catch (error: any) {
      // Show error message if registration fails
      setErrorMessage(error.message || "Failed to register. Please try again.");
    }
  };

  // ============================================================
  // UI Components - Helper functions to keep the main render clean
  // ============================================================

  // Reusable form field wrapper with label
  const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
        {label}
      </span>
      {children}
    </div>
  );

  // Input field with an icon inside
  const IconInputField: React.FC<IconInputFieldProps> = ({ id, icon: Icon, type = "text", placeholder, hint }) => (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        />
        <Input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          className="bg-[#080b10] border-white/8 text-white placeholder:text-white/20 h-11 pl-9 text-sm"
        />
      </div>
      {hint && <p className="text-[10px] text-white/30 pl-1">{hint}</p>}
    </div>
  );

  // Dropdown select field
  const SelectField: React.FC<SelectFieldProps> = ({ name, placeholder, children }) => (
    <Select name={name}>
      <SelectTrigger className="w-full h-11 bg-[#080b10] border-white/8 text-white text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-dark-card border-dark-border text-white">
        {children}
      </SelectContent>
    </Select>
  );

  // Google Map Location Picker Component
  const LocationPicker: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 6.9271, lng: 79.8612 }, // Colombo default
        zoom: 12,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a3e" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e0e1a" }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });

      const initialMarker = new google.maps.Marker({
        position: { lat: 6.9271, lng: 79.8612 },
        map,
        draggable: true,
        title: "Drag to your delivery location",
      });

      // setMarker(initialMarker);

      // Try to get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          map.setCenter(pos);
          initialMarker.setPosition(pos);
          onLocationSelect(pos.lat, pos.lng);
        });
      }

      initialMarker.addListener("dragend", () => {
        const pos = initialMarker.getPosition();
        if (pos) {
          onLocationSelect(pos.lat(), pos.lng());
        }
      });

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          initialMarker.setPosition(e.latLng);
          onLocationSelect(e.latLng.lat(), e.latLng.lng());
        }
      });
    }, []);

    return (
      <div className="relative group">
        <div ref={mapRef} className="w-full h-64 rounded-2xl border border-white/10 overflow-hidden mt-2 shadow-2xl" />
        <button
          type="button"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((position) => {
                const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                onLocationSelect(pos.lat, pos.lng);
              });
            }
          }}
          className="absolute bottom-4 right-4 bg-brand text-brand-on px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          My Location
        </button>
      </div>
    );
  };

  const renderMapStatus = (status: Status) => {
    if (status === Status.LOADING) return <div className="h-48 w-full bg-white/5 animate-pulse rounded-xl mt-2 flex items-center justify-center text-white/20 text-xs">Loading map...</div>;
    if (status === Status.FAILURE) return <div className="h-48 w-full bg-red-500/5 rounded-xl mt-2 flex items-center justify-center text-red-500/40 text-xs">Failed to load map</div>;
    return <></>;
  };

  // ============================================================
  // Role-specific form sections
  // ============================================================

  // Form fields for Retail Customers
  const RetailCustomerForm = () => (
    <div className="flex flex-col gap-4">
      {/* Business Identity Section */}
      <div className="border-b border-white/5 pb-3">
        <p className="text-[11px] text-brand font-bold uppercase">
          Business Identity
        </p>
      </div>

      <FormField label="Business Name">
        <IconInputField id="businessName" icon={Briefcase} placeholder="ABC Supermarket" />
      </FormField>

      <FormField label="Contact Person">
        <IconInputField id="contactPerson" icon={User} placeholder="Primary representative name" />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone Number">
          <IconInputField id="phone" icon={Phone} placeholder="+94 77 123 4567" />
        </FormField>
        <FormField label="Email Address">
          <IconInputField
            id="email"
            icon={Mail}
            type="email"
            placeholder="orders@shop.lk"
            hint="Used for invoices & alerts"
          />
        </FormField>
      </div>

      <FormField label="Business Type">
        <SelectField name="businessType" placeholder="Select business type">
          <SelectItem value="supermarket">Supermarket</SelectItem>
          <SelectItem value="reseller">Reseller</SelectItem>
          <SelectItem value="outlet">Retail Outlet</SelectItem>
        </SelectField>
      </FormField>

      {/* Location & Delivery Section */}
      <div className="border-b border-white/5 pb-3 mt-2">
        <p className="text-[11px] text-brand font-bold uppercase">
          Location & Delivery
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="District">
          <SelectField name="district" placeholder="Select district">
            <SelectItem value="colombo">Colombo</SelectItem>
            <SelectItem value="kandy">Kandy</SelectItem>
            <SelectItem value="galle">Galle</SelectItem>
          </SelectField>
        </FormField>
        <FormField label="Province">
          <SelectField name="province" placeholder="Select province">
            <SelectItem value="western">Western</SelectItem>
            <SelectItem value="central">Central</SelectItem>
            <SelectItem value="southern">Southern</SelectItem>
          </SelectField>
        </FormField>
      </div>

      <FormField label="Delivery Address">
        <IconInputField
          id="address"
          icon={MapPinned}
          placeholder="No. 25, Main Street, Colombo 03"
          hint="Full shipping address"
        />
        <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={(status) => renderMapStatus(status) as any}>
          <div className="mt-3">
            <p className="text-[10px] text-white/45 mb-2 italic">
              Pin your exact warehouse/shop location for accurate delivery routes
            </p>
            <LocationPicker onLocationSelect={(lat, lng) => setCoordinates({ lat, lng })} />
            {coordinates && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-brand font-medium animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 size={12} />
                Location pinned: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </div>
            )}
          </div>
        </Wrapper>
      </FormField>

      {/* Login Section */}
      <div className="border-b border-white/5 pb-3 mt-2">
        <p className="text-[11px] text-brand font-bold uppercase">
          Portal Login
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Password">
          <IconInputField id="password" icon={Lock} type="password" placeholder="Create password" />
        </FormField>
        <FormField label="Confirm Password">
          <IconInputField id="confirmPassword" icon={Lock} type="password" placeholder="Confirm password" />
        </FormField>
      </div>
    </div>
  );

  // Form fields for RDC Staff
  const RdcStaffForm = () => (
    <div className="flex flex-col gap-4">
      {/* Staff Identity Section */}
      <div className="border-b border-white/5 pb-3">
        <p className="text-[11px] text-brand font-bold uppercase">
          Staff Identity
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="First Name">
          <IconInputField id="firstName" icon={User} placeholder="First name" />
        </FormField>
        <FormField label="Last Name">
          <IconInputField id="lastName" icon={User} placeholder="Last name" />
        </FormField>
      </div>

      <FormField label="NIC Number">
        <IconInputField id="nicNumber" icon={IdCard} placeholder="NIC" />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone Number">
          <IconInputField
            id="staffPhone"
            icon={Phone}
            placeholder="+94 77 000 0000"
            hint="Internal contact"
          />
        </FormField>
        <FormField label="Work Email">
          <IconInputField
            id="staffEmail"
            icon={Mail}
            type="email"
            placeholder="staff@islandlink.com"
          />
        </FormField>
      </div>

      {/* System Access Section */}
      <div className="border-b border-white/5 pb-3 mt-2">
        <p className="text-[11px] text-brand font-bold uppercase">
          System Access
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Password">
          <IconInputField id="staffPassword" icon={Lock} type="password" placeholder="Create password" />
        </FormField>
        <FormField label="Confirm Password">
          <IconInputField id="staffConfirmPassword" icon={Lock} type="password" placeholder="Confirm" />
        </FormField>
      </div>
    </div>
  );

  // Map role IDs to their form sections (as functions to prevent remounting)
  const formForRole = {
    "retail-customer": RetailCustomerForm(),
    "rdc-staff": RdcStaffForm(),
  };

  // ============================================================
  // MAIN RENDER - Shows different content based on current step
  // ============================================================
  return (
    <div className="min-h-screen bg-site-bg text-white">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
            <Layers size={15} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-[14px]">ISDN</span>
            <span className="block text-[9px] text-white/35">IslandLink Network</span>
          </div>
        </Link>
        <p className="text-xs text-white/40">
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </nav>

      {/* Progress Tracker - Shows which step user is on */}
      <div className="flex justify-center pt-8 pb-2">
        <div className="flex items-center gap-2">
          {["Select Role", "Fill Details", "Done"].map((label, index) => {
            // Determine if this step is active, completed, or pending
            const isActive =
              (currentStep === "role" && index === 0) ||
              (currentStep === "info" && index === 1) ||
              (currentStep === "done" && index === 2);

            const isCompleted =
              (currentStep === "info" && index === 0) ||
              (currentStep === "done" && index <= 1);

            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Step number circle */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold
                    ${isCompleted ? "bg-brand text-white" :
                      isActive ? "bg-brand/30 border border-brand text-brand" :
                        "bg-white/5 border border-white/10 text-white/30"}`}
                  >
                    {isCompleted ? <CheckCircle2 size={13} /> : index + 1}
                  </div>
                  <span className={`text-[11px] hidden sm:block
                    ${isActive ? "text-white" :
                      isCompleted ? "text-brand" : "text-white/30"}`}
                  >
                    {label}
                  </span>
                </div>
                {/* Connector line between steps */}
                {index < 2 && (
                  <div className={`w-8 h-px ${isCompleted ? "bg-brand" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex justify-center px-4 py-8">
        <div className="w-full max-w-[560px]">

          {/* STEP 1: Role Selection */}
          {currentStep === "role" && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Create your account</h1>
                <p className="text-white/45 text-sm">
                  Select your role to get the right registration form.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role.id);
                      setCurrentStep("info");
                    }}
                    className="flex items-center gap-5 p-5 rounded-2xl border border-white/8 bg-dark-card hover:border-brand text-left"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 shrink-0">
                      <role.icon size={22} className="text-white/70" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm">{role.title}</h3>
                        <span className="text-[10px] border border-brand-border text-brand px-2 py-0.5 rounded-full">
                          {role.tag}
                        </span>
                      </div>
                      <p className="text-xs text-white/45">{role.description}</p>
                    </div>
                    <ChevronRight size={18} className="text-white/20" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 2: Fill in Details Form */}
          {currentStep === "info" && selectedRoleDetails && (
            <>
              {/* Back button and header */}
              <div className="mb-6">
                <button
                  onClick={() => {
                    setCurrentStep("role");
                    setSelectedRole("");
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-brand mb-4"
                >
                  <ArrowLeft size={13} /> Back to role selection
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                    <selectedRoleDetails.icon size={18} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">
                      Register as {selectedRoleDetails.title}
                    </h1>
                    <p className="text-xs text-white/40 mt-0.5">
                      {selectedRoleDetails.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Registration Form */}
              <div className="bg-dark-card border border-dark-border rounded-3xl p-6">
                <form onSubmit={handleSubmit}>
                  {/* Show the appropriate form based on selected role */}
                  {selectedRole && formForRole[selectedRole]}

                  {/* Submit button */}
                  <button
                    type="submit"
                    className="w-full mt-6 flex items-center justify-center gap-2 bg-brand text-brand-on h-11 rounded-xl text-sm font-bold"
                  >
                    Submit Registration
                  </button>

                  {/* Helper text based on role */}
                  <p className="text-[11px] text-white/30 text-center mt-3">
                    {selectedRole === "retail-customer"
                      ? "Retail accounts are reviewed and activated within 24 hours."
                      : "Staff accounts require verification by the ISDN admin team."}
                  </p>

                  {/* Error message display */}
                  {errorMessage && (
                    <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
                      {errorMessage}
                    </div>
                  )}
                </form>
              </div>
            </>
          )}

          {/* STEP 3: Registration Complete */}
          {currentStep === "done" && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-brand/20 border border-brand flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-brand" />
              </div>

              <h2 className="text-3xl font-bold mb-3">Registration Submitted!</h2>

              <p className="text-white/50 text-sm max-w-sm mx-auto mb-8">
                Your registration has been submitted for review. You'll receive
                a confirmation email once your account is activated.
              </p>

              <div className="flex gap-3 justify-center">
                <Link
                  to="/login"
                  className="bg-brand text-brand-on px-6 py-3 rounded-xl text-sm font-bold"
                >
                  Go to Login
                </Link>
                <Link
                  to="/"
                  className="border border-white/10 bg-white/5 text-white/70 hover:text-white px-6 py-3 rounded-xl text-sm"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;