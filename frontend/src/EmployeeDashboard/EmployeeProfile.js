import React, { useEffect, useState } from 'react';
import styles from '../styles/EmployeeProfile.module.css';
import API_BASE_URL from '../api';

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
    photoUrl: '',
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
        const res = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        if (data.date_of_hire) {
          data.date_of_hire = formatDateInput(data.date_of_hire);
        }
        
        // Fix: Convert profile_photo to photoUrl and construct full URL
        if (data.profile_photo) {
          data.photoUrl = `${API_BASE_URL}${data.profile_photo}`;
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
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
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
        const res = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        if (data.date_of_hire) data.date_of_hire = formatDateInput(data.date_of_hire);
        
        // Fix: Convert profile_photo to photoUrl and construct full URL
        if (data.profile_photo) {
          data.photoUrl = `${API_BASE_URL}${data.profile_photo}`;
        }
        
        setProfile(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/profile/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      // Fix: Update photoUrl with the full URL
      setProfile((prev) => ({ 
        ...prev, 
        photoUrl: `${API_BASE_URL}${data.photo}` 
      }));
      
      setSuccessMsg('Photo uploaded successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className={styles.loading}>Loading profile...</div>;
  if (error && !editMode) return <div className={styles.errorMessage}>Error: {error}</div>;

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileGrid}>
        {/* Left side */}
        <div className={styles.profileLeft}>
          <h2>Employee Profile</h2>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMsg && <div className={styles.successMessage}>{successMsg}</div>}

          {!editMode ? (
            <div className={styles.profileView}>
              <p><strong>Full Name:</strong> {profile.fullname || '-'}</p>
              <p><strong>Email:</strong> {profile.email || '-'}</p>
              <p><strong>Role:</strong> {profile.role || '-'}</p>
              <p><strong>Department:</strong> {profile.department || '-'}</p>
              <p><strong>Job Title:</strong> {profile.job_title || '-'}</p>
              <p><strong>Phone:</strong> {profile.phone || '-'}</p>
              <p><strong>Address:</strong> {profile.address || '-'}</p>
              <p><strong>Status:</strong> {profile.status || '-'}</p>
              <p><strong>Date of Hire:</strong> {profile.date_of_hire || '-'}</p>
              <button onClick={() => setEditMode(true)} className={styles.buttonPrimary}>Edit Profile</button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className={styles.profileForm}
            >
              <div className={styles.formGroup}><label>Full Name:</label><input type="text" name="fullname" value={profile.fullname || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Email:</label><input type="email" name="email" value={profile.email || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Role:</label><input type="text" name="role" value={profile.role || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Department:</label><input type="text" name="department" value={profile.department || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Job Title:</label><input type="text" name="job_title" value={profile.job_title || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Phone:</label><input type="tel" name="phone" value={profile.phone || ''} onChange={handleChange} /></div>
              <div className={styles.formGroup}><label>Address:</label><textarea name="address" value={profile.address || ''} onChange={handleChange} /></div>
              <div className={styles.formGroup}><label>Status:</label><input type="text" name="status" value={profile.status || ''} readOnly /></div>
              <div className={styles.formGroup}><label>Date of Hire:</label><input type="date" name="date_of_hire" value={profile.date_of_hire || ''} readOnly /></div>
              <button type="submit" className={styles.buttonPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className={styles.buttonSecondary} onClick={handleCancel} disabled={saving}>Cancel</button>
            </form>
          )}
        </div>

        {/* Right side */}
        <div className={styles.profileRight}>
          <h3>Profile Photo</h3>
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="Profile" className={styles.profileImage} />
          ) : (
            <div className={styles.profilePlaceholder}>No Image</div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handlePhotoChange(e)}
            className={styles.fileInput}
          />
        </div>
      </div>
    </div>
  );
}

export default EmployeeProfile;