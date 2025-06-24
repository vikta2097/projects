import React, { useEffect, useState } from 'react';
import '../styles/EmployeeProfile.css'; // Make sure this path is correct

function EmployeeProfile() {
  const [profile, setProfile] = useState({
    fullname: '',
    email: '',
    role: '',
    department: '',
    job_title: '',
    phone: '',
    address: '',
    status: '',
    date_of_hire: '',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const formatDateInput = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        if (data.date_of_hire) {
          data.date_of_hire = formatDateInput(data.date_of_hire);
        }
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!profile.phone.trim()) return 'Phone number is required';
    if (!profile.address.trim()) return 'Address is required';
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      // Send only phone and address in body to prevent accidental updates to other fields
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: profile.phone,
          address: profile.address,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to save profile');
      }

      const updated = await res.json();
      // Update the local profile state with updated phone and address (keep other fields intact)
      setProfile((prev) => ({
        ...prev,
        phone: updated.phone,
        address: updated.address,
      }));

      setSuccessMsg('Profile updated successfully');
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setError(null);
    setSuccessMsg('');
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        if (data.date_of_hire) data.date_of_hire = formatDateInput(data.date_of_hire);
        setProfile(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  };

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error && !editMode) return <div className="error">Error: {error}</div>;

  return (
    <div className="profile-container">
      <h2>Employee Profile</h2>

      {error && <div className="error">{error}</div>}
      {successMsg && <div className="success">{successMsg}</div>}

      {!editMode ? (
        <div className="profile-view">
          <p><strong>Full Name:</strong> {profile.fullname || '-'}</p>
          <p><strong>Email:</strong> {profile.email || '-'}</p>
          <p><strong>Role:</strong> {profile.role || '-'}</p>
          <p><strong>Department:</strong> {profile.department || '-'}</p>
          <p><strong>Job Title:</strong> {profile.job_title || '-'}</p>
          <p><strong>Phone:</strong> {profile.phone || '-'}</p>
          <p><strong>Address:</strong> {profile.address || '-'}</p>
          <p><strong>Status:</strong> {profile.status || '-'}</p>
          <p><strong>Date of Hire:</strong> {profile.date_of_hire || '-'}</p>
          <button onClick={() => setEditMode(true)} className="btn-primary">Edit Profile</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="profile-form"
        >
          <div className="form-group">
            <label>Full Name:</label>
            <input type="text" name="fullname" value={profile.fullname || ''} readOnly />
          </div>
          <div className="form-group">
            <label>Email:</label>
            <input type="email" name="email" value={profile.email || ''} readOnly />
          </div>
          <div className="form-group">
            <label>Role:</label>
            <input type="text" name="role" value={profile.role || ''} readOnly />
          </div>
          <div className="form-group">
            <label>Department:</label>
            <input type="text" name="department" value={profile.department || ''} readOnly />
          </div>
          <div className="form-group">
            <label>Job Title:</label>
            <input type="text" name="job_title" value={profile.job_title || ''} readOnly />
          </div>

          <div className="form-group">
            <label>Phone:</label>
            <input type="tel" name="phone" value={profile.phone || ''} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Address:</label>
            <textarea name="address" value={profile.address || ''} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Status:</label>
            <input type="text" name="status" value={profile.status || ''} readOnly />
          </div>

          <div className="form-group">
            <label>Date of Hire:</label>
            <input type="date" name="date_of_hire" value={profile.date_of_hire || ''} readOnly />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

export default EmployeeProfile;
