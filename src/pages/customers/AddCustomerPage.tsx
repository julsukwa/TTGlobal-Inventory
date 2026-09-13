import "./AddCustomerPage.css";

function AddCustomerPage() {
  return (
    <div className="add-customer-page">

      <div className="page-header">

        <div>
          <h1>Add Customer</h1>

          <p>
            Create a new customer record in the inventory system.
          </p>
        </div>

      </div>

      <div className="form-card">

        <h3>Customer Information</h3>

        <div className="form-grid">

          <div className="form-group">
            <label>Customer Name *</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input type="email" />
          </div>

          <div className="form-group">
            <label>Phone Number *</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>Alternative Phone</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>Address</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>City</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>State</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>Country</label>
            <input type="text" />
          </div>

        </div>

        <div className="form-group notes-group">
          <label>Notes</label>
          <textarea rows={5}></textarea>
        </div>

        <div className="form-footer">

          <button className="cancel-btn">
            Cancel
          </button>

          <button className="save-btn">
            Save Customer
          </button>

        </div>

      </div>

    </div>
  );
}

export default AddCustomerPage;