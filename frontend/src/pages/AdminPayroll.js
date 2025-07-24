import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../api';
import '../styles/AdminPayroll.css';

function AdminPayroll() {
  const [employees, setEmployees] = useState([]);
  const [salaryInputs, setSalaryInputs] = useState({});
  const [originalSalaryInputs, setOriginalSalaryInputs] = useState({});
  const [errors, setErrors] = useState({});
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingIds, setLoadingIds] = useState([]); // array of emp IDs currently saving
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchEmployees();
    fetchPayroll();
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      const data = await res.json();

      const advanceRes = await fetch(`${API_BASE_URL}/api/payroll/advance-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let advances = {};
      if (advanceRes.ok) {
        const advData = await advanceRes.json();
        advData.forEach(a => {
          advances[a.employee_id] = a.amount;
        });
      }

      setEmployees(data);

      const initInputs = {};
      data.forEach(emp => {
        initInputs[emp.id] = {
          basic_salary: '',
          allowance: '',
          deduction_rate: '',
          advance_payment: advances[emp.id] ?? '',
        };
      });
      setSalaryInputs(initInputs);
      setOriginalSalaryInputs(initInputs);
      setErrors({});
    } catch (err) {
      console.error('Error fetching employees or advances:', err);
      setStatusMessage('❌ Error loading employees or advance payments.');
    }
  };

  const fetchPayroll = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/payroll`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch payroll records');
      const data = await res.json();
      setPayrollRecords(data);
    } catch (err) {
      console.error('Error fetching payroll:', err);
      setStatusMessage('❌ Error loading payroll records.');
    }
  };

  const validateInput = (empId, field, value) => {
    let errMsg = '';
    if (value === '') return errMsg; // empty is allowed for now

    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      errMsg = 'Must be a valid number';
    } else if (numVal < 0) {
      errMsg = 'Cannot be negative';
    } else if (field === 'deduction_rate' && numVal > 100) {
      errMsg = 'Cannot exceed 100%';
    }
    setErrors(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: errMsg },
    }));
    return errMsg === '';
  };

  const updateInput = (empId, field, value) => {
    // Validate first
    if (!validateInput(empId, field, value)) {
      // Don't update invalid input
      return;
    }

    setSalaryInputs(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));

    // Clear status message if it was error
    if (statusMessage.startsWith('❌')) {
      setStatusMessage('');
    }
  };

  const hasChanged = (empId) => {
    const original = originalSalaryInputs[empId] || {};
    const current = salaryInputs[empId] || {};
    return (
      original.basic_salary !== current.basic_salary ||
      original.allowance !== current.allowance ||
      original.deduction_rate !== current.deduction_rate ||
      original.advance_payment !== current.advance_payment
    );
  };

  const saveSalary = async (empId) => {
    if (!window.confirm('Save salary details for this employee?')) return;

    if (loadingIds.includes(empId)) return; // already saving

    const salary = salaryInputs[empId];
    if (!salary) {
      setStatusMessage('❌ Enter salary details before saving.');
      return;
    }

    const basic_salary = parseFloat(salary.basic_salary) || 0;
    const allowance = parseFloat(salary.allowance) || 0;
    const deduction_rate = parseFloat(salary.deduction_rate) || 0;
    const advance_payment = parseFloat(salary.advance_payment) || 0;

    if (basic_salary < 0 || allowance < 0 || deduction_rate < 0 || advance_payment < 0) {
      setStatusMessage('❌ Salary values cannot be negative.');
      return;
    }

    if (deduction_rate > 100) {
      setStatusMessage('❌ Deduction rate cannot exceed 100%.');
      return;
    }

    setLoadingIds(ids => [...ids, empId]);
    try {
      const res1 = await fetch(`${API_BASE_URL}/api/payroll/employee-salary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: empId,
          basic_salary: Number(basic_salary.toFixed(2)),
          allowance: Number(allowance.toFixed(2)),
          deduction_rate: Number(deduction_rate.toFixed(2)),
        }),
      });

      if (!res1.ok) {
        const data = await res1.json();
        throw new Error(data.message || 'Failed to save salary');
      }

      if (advance_payment > 0) {
        const res2 = await fetch(`${API_BASE_URL}/api/payroll/advance-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employee_id: empId,
            amount: Number(advance_payment.toFixed(2)),
          }),
        });

        if (!res2.ok) {
          const data = await res2.json();
          throw new Error(data.message || 'Failed to save advance payment');
        }
      }

      setStatusMessage(`✅ Salary and advance payment saved for employee ID ${empId}`);

      // Update original inputs to current inputs (mark as saved)
      setOriginalSalaryInputs(prev => ({
        ...prev,
        [empId]: { ...salaryInputs[empId] },
      }));

      // Refresh employees to reload advance payments and reset inputs accordingly
      fetchEmployees();
    } catch (err) {
      setStatusMessage(`❌ ${err.message}`);
      console.error(err);
    } finally {
      setLoadingIds(ids => ids.filter(id => id !== empId));
    }
  };

  const generatePayroll = async () => {
    if (!window.confirm(`Generate payroll for ${month}/${year}? This may overwrite existing records.`)) return;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (!monthNum || monthNum < 1 || monthNum > 12) {
      setStatusMessage('❌ Please enter a valid month (1-12).');
      return;
    }

    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      setStatusMessage('❌ Please enter a valid year (2000-2100).');
      return;
    }

    setLoadingGenerate(true);
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/payroll/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: monthNum,
          year: yearNum,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage('✅ Payroll generated successfully.');
        fetchPayroll();
      } else {
        setStatusMessage(`❌ ${data.message || 'Failed to generate payroll.'}`);
      }
    } catch (err) {
      setStatusMessage('❌ Failed to generate payroll.');
      console.error(err);
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
      setMonth(value);
    }
  };

  const handleYearChange = (e) => {
    const value = e.target.value;
    if (value === '' || (parseInt(value) >= 2000 && parseInt(value) <= 2100)) {
      setYear(value);
    }
  };

  return (
    <div className="admin-payroll-card">
      <h2>Admin Payroll</h2>

      <section className="salary-section">
        <h3>Set Salaries & Advance Payments</h3>
        {employees.length === 0 && <p>No employees found.</p>}
        {employees.map(emp => {
          const hasError = errors[emp.id] || {};
          const changed = hasChanged(emp.id);
          return (
            <div
              key={emp.id}
              className={`input-row${changed ? ' changed' : ''}`}
              style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}
            >
              <strong style={{ minWidth: '150px' }}>{emp.name}</strong>
              {['basic_salary', 'allowance', 'deduction_rate', 'advance_payment'].map(field => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column' }}>
                  <input
                    type="number"
                    placeholder={field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    onChange={e => updateInput(emp.id, field, e.target.value)}
                    value={salaryInputs[emp.id]?.[field] ?? ''}
                    min="0"
                    max={field === 'deduction_rate' ? '100' : undefined}
                    step="0.01"
                    style={hasError[field] ? { borderColor: 'red' } : {}}
                    aria-label={`${field} for ${emp.name}`}
                  />
                  {hasError[field] && (
                    <small style={{ color: 'red', fontSize: '0.75em' }}>{hasError[field]}</small>
                  )}
                </div>
              ))}
              <button
                onClick={() => saveSalary(emp.id)}
                disabled={!changed || loadingIds.includes(emp.id)}
                aria-busy={loadingIds.includes(emp.id)}
                style={{ minWidth: '80px' }}
              >
                {loadingIds.includes(emp.id) ? 'Saving...' : 'Save'}
              </button>
            </div>
          );
        })}
      </section>

      <section className="generate-section" style={{ marginTop: '2rem' }}>
        <h3>Generate Payroll</h3>
        <input
          type="number"
          placeholder="Month (1-12)"
          value={month}
          onChange={handleMonthChange}
          min="1"
          max="12"
          style={{ marginRight: '10px', width: '100px' }}
        />
        <input
          type="number"
          placeholder="Year (e.g. 2025)"
          value={year}
          onChange={handleYearChange}
        
          style={{ marginRight: '10px', width: '120px' }}
        />
        <button
          onClick={generatePayroll}
          disabled={loadingGenerate}
          aria-busy={loadingGenerate}
          style={{ minWidth: '150px' }}
        >
          {loadingGenerate ? 'Generating...' : 'Generate Payroll'}
        </button>
      </section>

      <section className="history-section" style={{ marginTop: '2rem' }}>
        <h3>Payroll Records</h3>
        {payrollRecords.length === 0 ? (
          <p>No payroll records found.</p>
        ) : (
          <table className="payroll-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month</th>
                <th>Net Salary (KES)</th>
                <th>Deductions (KES)</th>
                <th>Generated On</th>
              </tr>
            </thead>
            <tbody>
              {payrollRecords.map((record, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                  <td>{record.name}</td>
                  <td>{record.month}/{record.year}</td>
                  <td>{Number(record.net_salary || 0).toLocaleString()}</td>
                  <td>{Number(record.deductions || 0).toLocaleString()}</td>
                  <td>{new Date(record.generated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {statusMessage && (
        <div
          className={`status-message ${statusMessage.startsWith('✅') ? 'success' : 'error'}`}
          style={{
            marginTop: '1rem',
            padding: '10px',
            borderRadius: '4px',
            color: statusMessage.startsWith('✅') ? 'green' : 'red',
            border: `1px solid ${statusMessage.startsWith('✅') ? 'green' : 'red'}`,
            fontWeight: 'bold',
          }}
          role="alert"
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export default AdminPayroll;
