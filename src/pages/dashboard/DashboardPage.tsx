import "./DashboardPage.css";

function DashboardPage() {
  return (
    <div className="dashboard-page">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back, Admin. Here's a summary of your inventory.
          </p>
        </div>

        <button className="date-button">
          May 12 - May 18, 2024
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="kpi-grid">

        <div className="kpi-card received">
          <div className="kpi-icon">⬇</div>

          <div className="kpi-content">
            <span className="kpi-title">
              INVENTORY RECEIVED
            </span>

            <div className="kpi-value">
              <h2>7,665</h2>
              <span>units</span>
            </div>

            <p className="kpi-trend positive">
              ↑ 8.7% vs last week
            </p>
          </div>
        </div>

        <div className="kpi-card issued">
          <div className="kpi-icon">⬆</div>

          <div className="kpi-content">
            <span className="kpi-title">
              INVENTORY ISSUED
            </span>

            <div className="kpi-value">
              <h2>3,892</h2>
              <span>units</span>
            </div>

            <p className="kpi-trend negative">
              ↓ 2.1% vs last week
            </p>
          </div>
        </div>

        <div className="kpi-card available">
          <div className="kpi-icon">✓</div>

          <div className="kpi-content">
            <span className="kpi-title">
              AVAILABLE STOCK
            </span>

            <div className="kpi-value">
              <h2>3,773</h2>
              <span>units</span>
            </div>

            <p className="kpi-trend positive">
              ↑ 6.4% vs last week
            </p>
          </div>
        </div>

        <div className="kpi-card faulty">
          <div className="kpi-icon">⚠</div>

          <div className="kpi-content">
            <span className="kpi-title">
              FAULTY STOCK
            </span>

            <div className="kpi-value">
              <h2>708</h2>
              <span>units</span>
            </div>

            <p className="kpi-trend negative">
              ↑ 3.6% vs last week
            </p>
          </div>
        </div>

        <div className="kpi-card low">
          <div className="kpi-icon">📦</div>

          <div className="kpi-content">
            <span className="kpi-title">
              LOW STOCK ITEMS
            </span>

            <div className="kpi-value">
              <h2>138</h2>
              <span>items</span>
            </div>

            <p className="kpi-trend positive">
              ↓ 5.4% vs last week
            </p>
          </div>
        </div>

      </div>

      {/* MAIN ROW */}
      <div className="dashboard-row">

        <div className="panel">
          <h3>Inventory Overview</h3>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Total Stock</th>
                <th>Faulty</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Laptop</td>
                <td>4366</td>
                <td>52</td>
                <td>In Stock</td>
              </tr>

              <tr>
                <td>Desktop</td>
                <td>1245</td>
                <td>17</td>
                <td>In Stock</td>
              </tr>

              <tr>
                <td>RAM</td>
                <td>14</td>
                <td>1</td>
                <td>Low Stock</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Stock By Location</h3>

          <p>All In One Zone — 27.5%</p>
          <p>Laptop Zone — 22.8%</p>
          <p>Desktop Zone — 20.0%</p>
          <p>Storage Zone — 14.8%</p>
        </div>

      </div>

      {/* RECENT ACTIVITIES */}
      <div className="panel">
        <h3>Recent Activities</h3>

        <ul>
          <li>Stock In completed successfully.</li>
          <li>Low Stock Alert generated.</li>
          <li>Inventory adjustment created.</li>
          <li>New item added to database.</li>
        </ul>
      </div>

    </div>
  );
}

export default DashboardPage;