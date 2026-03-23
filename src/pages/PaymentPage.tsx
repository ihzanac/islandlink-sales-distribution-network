import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { CheckCircle2, Layers } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#08080C] text-white flex items-center justify-center">
        Invalid Payment Request
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#08080C] text-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mb-6 animate-pulse">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="text-3xl font-bold mb-3">Payment Successful!</h2>
        <p className="text-white/50 text-sm mb-2 text-center">
          Thank you. Your order #{orderId.slice(0, 8).toUpperCase()} has been confirmed.
        </p>
        <p className="text-white/30 text-xs">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080C] text-white flex flex-col items-center p-6 pt-16">
      <Link to="/" className="flex items-center gap-3 mb-10 opacity-70 hover:opacity-100 transition">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
          <Layers size={15} className="text-white" />
        </div>
        <span className="text-white font-bold text-[14px]">ISDN Secure Checkout</span>
      </Link>

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Total to Pay</h2>
          <span className="text-2xl font-black text-brand">LKR {amount}</span>
        </div>

        <div className="mt-8 relative min-h-[150px]">
          {isProcessing && (
            <div className="absolute inset-[-10px] bg-black/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center rounded-2xl">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-white font-bold text-sm">Processing...</p>
              <p className="text-white/50 text-[10px] mt-1">Please wait</p>
            </div>
          )}

          {/* Terms & Conditions Checkbox */}
          <div className="mb-6 flex items-start gap-3 bg-[#08080C] border border-white/10 p-4 rounded-xl">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 flex-shrink-0 w-4 h-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-white/50 cursor-pointer leading-relaxed select-none">
              I agree to the <span className="text-white hover:text-brand transition-colors underline">Terms & Conditions</span> and <span className="text-white hover:text-brand transition-colors underline">Refund Policy</span>. I understand that my payment will be processed securely via PayPal.
            </label>
          </div>

          <PayPalScriptProvider options={{ clientId: "test", currency: "USD" }}>
            <PayPalButtons
              disabled={!termsAccepted}
              createOrder={(_data: any, actions: any) => {
                const safeAmount = amount || "0";
                const usdAmount = (parseFloat(safeAmount) / 300).toFixed(2);
                return actions.order.create({
                  intent: "CAPTURE",
                  purchase_units: [
                    {
                      amount: {
                        currency_code: "USD",
                        value: usdAmount,
                      },
                      description: `iIslandLink Order ${orderId.slice(0, 8).toUpperCase()}`,
                    },
                  ],
                });
              }}
              onApprove={async (_data: any, actions: any) => {
                if (!actions.order) return;
                setIsProcessing(true);
                try {
                  const details = await actions.order.capture();
                  await updateDoc(doc(db, "orders", orderId), {
                    status: "payment_complete",
                    paymentDate: new Date().toISOString(),
                    paypalOrderId: details.id,
                    paypalPayerId: details.payer?.payer_id || "unknown",
                  });
                  setIsSuccess(true);
                  setTimeout(() => navigate("/customer-history"), 3000);
                } catch (err) {
                  console.error(err);
                  alert("Payment capture failed. Please try again.");
                } finally {
                  setIsProcessing(false);
                }
              }}
              onError={(err) => {
                console.error("PayPal Error:", err);
                alert("An error occurred with PayPal. Please try again.");
              }}
              onCancel={() => {
                alert("Payment was cancelled.");
              }}
              style={{ layout: "vertical", shape: "rect", color: "gold" }}
            />
          </PayPalScriptProvider>
        </div>
      </div>
    </div>
  );
}
