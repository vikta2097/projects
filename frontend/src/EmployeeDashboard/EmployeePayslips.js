import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../api';
import { jsPDF } from "jspdf";
import { jwtDecode } from 'jwt-decode'; // ✅ Correct import
import '../styles/EmployeePayslips.css';

function EmployeePayslips() {
  const [payslips, setPayslips] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const token = localStorage.getItem('token');

  // ✅ Extract userId from token
  let userId = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      userId = decoded.id;
    } catch (err) {
      console.error("❌ Invalid token:", err);
    }
  }

  useEffect(() => {
    const allStorageItems = {
      token: localStorage.getItem('token'),
      userIdFromToken: userId,
      userIdRaw: localStorage.getItem('userId'),
    };

    setDebugInfo(JSON.stringify(allStorageItems, null, 2));

    if (userId && userId !== "undefined") {
      fetchPayslips(userId);
    } else {
      setStatusMessage('❌ User ID not found or invalid. Please log in again.');
    }
  }, [userId]);

  const fetchPayslips = async (uid) => {
    setLoading(true);
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/payroll/employee/user/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setStatusMessage('❌ No payslips found for this user.');
        } else if (res.status === 401) {
          setStatusMessage('❌ Authentication failed. Please log in again.');
        } else {
          throw new Error(`HTTP ${res.status}: Failed to fetch payslips`);
        }
        setPayslips([]);
        return;
      }

      const data = await res.json();
      setPayslips(data);
      setStatusMessage(data.length ? '✅ Payslips loaded successfully!' : 'ℹ️ No payslips available yet.');
    } catch (err) {
      setStatusMessage('❌ Failed to load payslips. Please try again.');
      console.error('Error fetching payslips:', err);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslipDetails = async (employeeId, month, year) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/payroll/payslip/${employeeId}/${month}/${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch payslip details`);
      }

      const data = await res.json();
      setSelectedPayslip(data);
      setShowDetails(true);
    } catch (err) {
      setStatusMessage('❌ Failed to load payslip details. Please try again.');
      console.error('Error fetching payslip details:', err);
    }
  };

  const generatePDF = async (slip) => {
    try {
      // First fetch detailed payslip data including advance payments
      const res = await fetch(`${API_BASE_URL}/api/payroll/payslip/${slip.employee_id}/${slip.month}/${slip.year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let detailedSlip = slip;
      if (res.ok) {
        detailedSlip = await res.json();
      }

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("PAYSLIP", 105, 20, null, null, "center");
      doc.setFontSize(12);
      doc.text("VIKTALABS", 105, 35, null, null, "center");
      doc.text("Employee Payslip", 105, 45, null, null, "center");

      doc.setFontSize(12);
      doc.text(`Employee Name: ${detailedSlip.employee_name || detailedSlip.name}`, 20, 65);
      doc.text(`Pay Period: ${detailedSlip.month}/${detailedSlip.year}`, 20, 75);
      doc.text(`Generated: ${new Date(detailedSlip.generated_at).toLocaleDateString()}`, 20, 85);

      doc.line(20, 95, 190, 95);

      // EARNINGS Section
      doc.text("EARNINGS:", 20, 110);
      doc.text(`Basic Salary: KES ${Number(detailedSlip.basic_salary || 0).toLocaleString()}`, 30, 125);
      doc.text(`Allowances: KES ${Number(detailedSlip.allowances || 0).toLocaleString()}`, 30, 135);

      const grossSalary = (Number(detailedSlip.basic_salary || 0) + Number(detailedSlip.allowances || 0));
      doc.text(`Gross Salary: KES ${grossSalary.toLocaleString()}`, 30, 145);

      // DEDUCTIONS Section
      let currentY = 160;
      doc.text("DEDUCTIONS:", 20, currentY);
      currentY += 15;

      // Show advance payments if any
      if (detailedSlip.advance_payments && detailedSlip.advance_payments.length > 0) {
        doc.text("Advance Payments:", 30, currentY);
        currentY += 10;
        
        let totalAdvancePayments = 0;
        detailedSlip.advance_payments.forEach((advance, index) => {
          const amount = Number(advance.amount || 0);
          totalAdvancePayments += amount;
          doc.text(`  • ${advance.reason || 'Advance Payment'}: KES ${amount.toLocaleString()}`, 40, currentY);
          currentY += 10;
        });
        
        doc.text(`Total Advance Payments: KES ${totalAdvancePayments.toLocaleString()}`, 30, currentY);
        currentY += 10;
      }

      // Calculate other deductions (total deductions - advance payments)
      const totalDeductions = Number(detailedSlip.deductions || 0);
      const advancePaymentsTotal = detailedSlip.advance_payments ? 
        detailedSlip.advance_payments.reduce((sum, ap) => sum + Number(ap.amount || 0), 0) : 0;
      const otherDeductions = totalDeductions - advancePaymentsTotal;

      if (otherDeductions > 0) {
        doc.text(`Other Deductions: KES ${otherDeductions.toLocaleString()}`, 30, currentY);
        currentY += 10;
      }

      doc.text(`Total Deductions: KES ${totalDeductions.toLocaleString()}`, 30, currentY);
      currentY += 15;

      // NET SALARY
      doc.line(20, currentY, 190, currentY);
      currentY += 15;
      doc.setFontSize(14);
      doc.text(`NET SALARY: KES ${Number(detailedSlip.net_salary || 0).toLocaleString()}`, 20, currentY);

      doc.setFontSize(10);
      doc.text("This is a computer-generated payslip. No signature required.", 105, currentY + 20, null, null, "center");

      doc.save(`Payslip_${detailedSlip.month}_${detailedSlip.year}_Employee_${detailedSlip.employee_id}.pdf`);
      setStatusMessage('✅ Payslip PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setStatusMessage('❌ Failed to generate PDF. Please try again.');
    }
  };

  const handleRefresh = () => {
    if (userId && userId !== "undefined") {
      fetchPayslips(userId);
    } else {
      setStatusMessage('❌ User ID not found or invalid. Please log in again.');
    }
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedPayslip(null);
  };

  return (
    <div className="employee-payslips-card">
      <h2>My Payslips</h2>
{/*
      <div style={{ background: '#f5f5f5', padding: '10px', marginBottom: '20px', fontSize: '12px' }}>
        <strong>🔍 Debug Info:</strong>
        <pre>{debugInfo}</pre>
      </div>
*/}
      <div className="payslip-actions">
        <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="payslip-info">
        {loading ? (
          <div className="loading">Loading payslips...</div>
        ) : payslips.length === 0 ? (
          <div className="no-payslips">
            <p>No payslips found.</p>
            <p>Payslips will appear here once they are generated by the admin.</p>
          </div>
        ) : (
          <table className="payslip-table">
            <thead>
              <tr>
                <th>Month/Year</th>
                <th>Basic Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net Salary</th>
                <th>Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip, index) => (
                <tr key={index}>
                  <td>{slip.month}/{slip.year}</td>
                  <td>KES {Number(slip.basic_salary || 0).toLocaleString()}</td>
                  <td>KES {Number(slip.allowances || 0).toLocaleString()}</td>
                  <td>KES {Number(slip.deductions || 0).toLocaleString()}</td>
                  <td><strong>KES {Number(slip.net_salary || 0).toLocaleString()}</strong></td>
                  <td>{new Date(slip.generated_at).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="view-btn" 
                      onClick={() => fetchPayslipDetails(slip.employee_id, slip.month, slip.year)}
                      title="View Details"
                    >
                      👁️ View
                    </button>
                    <button className="download-btn" onClick={() => generatePDF(slip)} title="Download PDF">
                      📄 PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payslip Details Modal */}
      {showDetails && selectedPayslip && (
        <div className="payslip-modal-overlay" onClick={closeDetails}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payslip-modal-header">
              <h3>Payslip Details - {selectedPayslip.month}/{selectedPayslip.year}</h3>
              <button className="close-btn" onClick={closeDetails}>×</button>
            </div>
            
            <div className="payslip-modal-content">
              <div className="payslip-section">
                <h4>Employee Information</h4>
                <p><strong>Name:</strong> {selectedPayslip.name}</p>
                <p><strong>Job Title:</strong> {selectedPayslip.job_title}</p>
                <p><strong>Department:</strong> {selectedPayslip.department}</p>
              </div>

              <div className="payslip-section">
                <h4>Earnings</h4>
                <p><strong>Basic Salary:</strong> KES {Number(selectedPayslip.basic_salary || 0).toLocaleString()}</p>
                <p><strong>Allowances:</strong> KES {Number(selectedPayslip.allowances || 0).toLocaleString()}</p>
                <p><strong>Gross Salary:</strong> KES {(Number(selectedPayslip.basic_salary || 0) + Number(selectedPayslip.allowances || 0)).toLocaleString()}</p>
              </div>

              <div className="payslip-section">
                <h4>Deductions</h4>
                
                {selectedPayslip.advance_payments && selectedPayslip.advance_payments.length > 0 && (
                  <div className="advance-payments">
                    <h5>Advance Payments Deducted:</h5>
                    {selectedPayslip.advance_payments.map((advance, index) => (
                      <div key={index} className="advance-payment-item">
                        <p><strong>Amount:</strong> KES {Number(advance.amount || 0).toLocaleString()}</p>
                        <p><strong>Reason:</strong> {advance.reason || 'N/A'}</p>
                      </div>
                    ))}
                    <p><strong>Total Advance Payments:</strong> KES {selectedPayslip.advance_payments.reduce((sum, ap) => sum + Number(ap.amount || 0), 0).toLocaleString()}</p>
                  </div>
                )}
                
                <p><strong>Total Deductions:</strong> KES {Number(selectedPayslip.deductions || 0).toLocaleString()}</p>
              </div>

              <div className="payslip-section">
                <h4>Net Salary</h4>
                <p className="net-salary"><strong>KES {Number(selectedPayslip.net_salary || 0).toLocaleString()}</strong></p>
              </div>

              <div className="payslip-actions">
                <button className="download-btn" onClick={() => generatePDF(selectedPayslip)}>
                  📄 Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`status-message ${
            statusMessage.startsWith('✅') ? 'success' : 
            statusMessage.startsWith('ℹ️') ? 'info' : 'error'
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export default EmployeePayslips;