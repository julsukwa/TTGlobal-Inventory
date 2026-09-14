import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import CustomerPage from "./pages/customers/CustomerPage";
import AddCustomerPage from "./pages/customers/AddCustomerPage";
import StaffPage from "./pages/staff/StaffPage";
import DropdownPage from "./pages/dropdowns/DropdownPage";
import ShipmentPage from "./pages/shipments/ShipmentPage";
import AdjustmentsPage from "./pages/adjustments/AdjustmentsPage";
import NewAdjustmentPage from "./pages/adjustments/NewAdjustmentPage";
import DatabasePage from "./pages/database/DatabasePage";
import StockInPage from "./pages/stock-in/StockInPage";
import ImportInventoryPage from "./pages/stock-in/ImportInventoryPage";
import ManualStockInPage from "./pages/stock-in/ManualStockInPage";
import ImportCsvPage from "./pages/stock-in/ImportCsvPage";
import ImportCsvPreviewPage from "./pages/stock-in/ImportCsvPreviewPage";
import ViewImportedInventoryPage from "./pages/stock-in/ViewImportedInventoryPage";
import StockInProcessingPage from "./pages/stock-in/StockInProcessingPage";
import StockInCompletePage from "./pages/stock-in/StockInCompletePage";

// Stock Out flow
import StockOutPage from "./pages/stock-out/StockOutPage";
import NewStockOutPage from "./pages/stock-out/NewStockOutPage";
import ScanItemsPage from "./pages/stock-out/ScanItemsPage";
import ReviewStockOutPage from "./pages/stock-out/ReviewStockOutPage";
import StockOutCompletePage from "./pages/stock-out/StockOutCompletePage";

function App() {
  return (
    <Routes>
      {/* Login */}
      <Route path="/" element={<LoginPage />} />

      {/* Dashboard and all app pages — auth required */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/customers"       element={<CustomerPage />} />
          <Route path="/customers/new"   element={<AddCustomerPage />} />
          <Route path="/staff"           element={<StaffPage />} />
          <Route path="/dropdowns"       element={<DropdownPage />} />
          <Route path="/shipments"       element={<ShipmentPage />} />
          <Route path="/adjustments"     element={<AdjustmentsPage />} />
          <Route path="/adjustments/new" element={<NewAdjustmentPage />} />
          <Route path="/database"        element={<DatabasePage />} />

          {/* Stock-In flow */}
          <Route path="/stock-in"                               element={<StockInPage />} />
          <Route path="/stock-in/:shipmentId"                   element={<ImportInventoryPage />} />
          <Route path="/stock-in/:shipmentId/manualentry"       element={<ManualStockInPage />} />
          <Route path="/stock-in/:shipmentId/importcsv"         element={<ImportCsvPage />} />
          <Route path="/stock-in/:shipmentId/importcsv/preview" element={<ImportCsvPreviewPage />} />
          <Route path="/stock-in/:shipmentId/inventory"         element={<ViewImportedInventoryPage />} />
          <Route path="/stock-in/:shipmentId/processing"        element={<StockInProcessingPage />} />
          <Route path="/stock-in/:shipmentId/complete"          element={<StockInCompletePage />} />

          {/* Stock-Out flow */}
          <Route path="/stock-out"          element={<StockOutPage />} />
          <Route path="/stock-out/new"      element={<NewStockOutPage />} />
          <Route path="/stock-out/scan"     element={<ScanItemsPage />} />
          <Route path="/stock-out/review"   element={<ReviewStockOutPage />} />
          <Route path="/stock-out/complete" element={<StockOutCompletePage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;