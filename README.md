# 🚚 IslandLink Sales Distribution Network (ISDN)

<p align="center">
  <img src="https://img.shields.io/badge/ISDN-Sales%20Distribution%20System-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript-black?style=for-the-badge">
  <img src="https://img.shields.io/badge/Backend-Firebase-orange?style=for-the-badge">
  <img src="https://img.shields.io/badge/Database-Firestore-yellow?style=for-the-badge">
  <img src="https://img.shields.io/badge/Maps-Google%20Maps-green?style=for-the-badge">
  <img src="https://img.shields.io/badge/Payments-PayHere%20%7C%20PayPal-blue?style=for-the-badge">
</p>

<p align="center">
  <b>Centralized Sales Distribution Management System</b>
  <br>
  A web-based platform for managing products, orders, inventory, payments, deliveries, logistics, and distribution operations.
</p>

---

## 🌟 System Overview

**IslandLink Sales Distribution Network (ISDN)** is a centralized web-based Sales Distribution Management System designed to connect retail customers, Regional Distribution Centres (RDCs), logistics teams, and Head Office management through a single digital platform.

The system provides an integrated digital workflow covering:

- 🛍️ Product browsing
- 🛒 Online ordering
- 📦 Inventory management
- 🧾 Digital invoicing
- 💳 Online payment
- 🚚 Delivery management
- 📍 GPS-based delivery tracking
- 👥 Role-based access control
- 📊 Reporting and analytics
- 🔄 Real-time data synchronization

---

## 🎯 System Objectives

| Objective | Description |
|---|---|
| 💻 Centralized Management | Manage island-wide sales and distribution operations through one platform |
| 🛒 Order Management | Allow retail customers to browse products and place orders |
| 📦 Inventory Control | Monitor and synchronize inventory across distribution centres |
| 🚚 Logistics Management | Coordinate deliveries and monitor delivery activities |
| 💳 Financial Processing | Support digital payments and payment-related operations |
| 📍 Delivery Tracking | Provide GPS-based delivery tracking and route information |
| 📊 Reporting | Provide dashboards, reports, and business analytics |
| 🔐 Security | Provide authentication and role-based access control |

---

## 🚀 Main Features

### 👤 Customer / Retailer Portal

- 🔐 Register and login
- 🛍️ Browse available products
- 🔎 Search products
- 🛒 Add products to cart
- 📝 Place orders
- 📦 View order details
- 📋 View order history
- 💳 Make online payments
- 🧾 Access digital invoices
- 🚚 Track deliveries
- 📍 View delivery information
- 🔄 Submit return requests
- 👤 Manage account information

---

## 🏢 Regional Distribution Centre (RDC)

RDC staff can manage distribution activities including:

- 📊 RDC dashboard
- 📦 Inventory monitoring
- 🛒 Order management
- ⚙️ Order processing
- 🔄 Stock updates
- 📦 Stock transfers between RDCs
- 🧾 Order and invoice information
- 🚚 Delivery assignment
- 📋 Delivery status management
- 📊 Distribution reports

---

## 🚚 Logistics & Delivery Management

The logistics module supports delivery coordination and monitoring.

### Features

- 🚚 Delivery assignment
- 👤 Driver / logistics management
- 📍 GPS location tracking
- 🗺️ Google Maps integration
- 🧭 Route information
- 📦 Shipment monitoring
- 🔄 Delivery status updates
- ⏱️ Delivery progress monitoring
- 📊 Delivery reports

### Delivery Workflow

```text
Order
  ↓
Processing
  ↓
Assigned for Delivery
  ↓
Shipped
  ↓
Delivered
Customer
   ↓
Checkout
   ↓
Payment Gateway
   ↓
PayHere / PayPal
   ↓
Payment Confirmation
   ↓
Firebase / Firestore
   ↓
Order Status Updated
                    ISDN SYSTEM
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    Customer           RDC Staff      Logistics
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Administrator

                    👥 USERS
                       │
                       ▼
              🌐 PRESENTATION LAYER
                       │
                React + TypeScript
                       │
                       ▼
              ⚙️ APPLICATION LAYER
                       │
                    Firebase
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
   Authentication  Firestore   Cloud Functions
          │            │            │
          └────────────┼────────────┘
                       │
                       ▼
                🗄️ DATA LAYER
                       │
                  Firestore DB
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Products        Orders        Inventory
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
              🌐 EXTERNAL SERVICES
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   PayHere           PayPal       Google Maps

📂 Project Modules
ISDN
│
├── 👤 Customer Module
│   ├── Registration
│   ├── Login
│   ├── Product Browsing
│   ├── Product Search
│   ├── Shopping Cart
│   ├── Order Placement
│   ├── Payment
│   ├── Digital Invoice
│   ├── Order History
│   ├── Delivery Tracking
│   └── Return Requests
│
├── 🏢 RDC Module
│   ├── RDC Dashboard
│   ├── Order Management
│   ├── Inventory Management
│   ├── Stock Transfer
│   ├── Stock Updates
│   └── Order Processing
│
├── 🚚 Logistics Module
│   ├── Delivery Assignment
│   ├── Driver Management
│   ├── GPS Tracking
│   ├── Delivery Status
│   └── Route Monitoring
│
├── 👨‍💼 Admin Module
│   ├── Dashboard
│   ├── User Management
│   ├── Customer Management
│   ├── Staff Management
│   ├── Product Management
│   ├── RDC Management
│   ├── Inventory Monitoring
│   ├── Order Management
│   ├── Delivery Management
│   ├── Payment Monitoring
│   └── Reports & Analytics
│
├── 💳 Payment Module
│   ├── PayHere
│   ├── PayPal
│   └── Payment Confirmation
│
├── 🧾 Invoice Module
│   ├── Customer Details
│   ├── Product Details
│   ├── Order Information
│   ├── Payment Reference
│   └── Digital Invoice
│
├── 🗺️ Google Maps Module
│   ├── GPS Tracking
│   ├── Route Information
│   ├── Location Services
│   └── Delivery Monitoring
│
└── 🔥 Firebase
    ├── Authentication
    ├── Firestore
    ├── Cloud Functions
    ├── Storage
    └── Hosting
🔄 Order Management Workflow
Customer
   │
   ▼
Browse Products
   │
   ▼
Add to Cart
   │
   ▼
Checkout
   │
   ▼
Payment
   │
   ▼
Order Created
   │
   ▼
RDC Processing
   │
   ▼
Inventory Updated
   │
   ▼
Delivery Assigned
   │
   ▼
Shipment
   │
   ▼
GPS Delivery Tracking
   │
   ▼
Delivered
📦 Inventory Workflow
Product Added
     ↓
Inventory Updated
     ↓
Customer Places Order
     ↓
Order Processing
     ↓
Stock Deducted
     ↓
Inventory Synchronization
     ↓
RDC Stock Updated
     ↓
Inventory Report
