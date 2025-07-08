import React, { useEffect, useState } from 'react';
import '../styles/MyAttendance.css';
import API_BASE_URL from '../api'; // ✅ Use the shared base URL

function MyAttendance() {
  const [statusMessage, setStatusMessage] = useState('');
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [checkInLocation, setCheckInLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    checkIfMarkedToday();
    getLocation();
  }, []);

  const handleSessionExpired = () => {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const checkIfMarkedToday = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/attendance/mine?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleSessionExpired();
        return;
      }

      if (res.status === 200) {
        const data = await res.json();
        if (data.marked) {
          setAlreadyMarked(true);
          setStatusMessage(`✅ You already checked in today at ${data.check_in}`);
        }
      }
    } catch (err) {
      console.error('Error checking today status:', err);
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );
      if (!response.ok) throw new Error('Failed to reverse geocode');

      const data = await response.json();
      return data.address.city || data.address.town || data.address.village || data.display_name || 'Unknown location';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Unknown location';
    }
  };

  const getLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords;
          const locationName = await reverseGeocode(latitude, longitude);
          setCheckInLocation(locationName);
        },
        err => {
          console.warn('Location access denied:', err.message);
          setCheckInLocation('Unavailable');
        }
      );
    } else {
      setCheckInLocation('Not supported');
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/attendance/mine`, { // ✅ Updated URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: today,
          check_in_location: checkInLocation,
        }),
      });

      if (res.status === 401) {
        handleSessionExpired();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setStatusMessage('✅ Attendance marked successfully.');
        setAlreadyMarked(true);
      } else {
        setStatusMessage(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      setStatusMessage('❌ Unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attendance-card">
      <h2>My Attendance</h2>
      <div className="attendance-info">
        <p><strong>Date:</strong> {today}</p>
        <p><strong>Location:</strong> {checkInLocation || 'Detecting...'}</p>
      </div>

      {alreadyMarked ? (
        <div className="status-message success">{statusMessage}</div>
      ) : (
        <>
          <button className="attendance-button" onClick={handleCheckIn} disabled={loading}>
            {loading ? 'Marking...' : 'Mark My Attendance'}
          </button>
          {statusMessage && <div className="status-message error">{statusMessage}</div>}
        </>
      )}
    </div>
  );
}

export default MyAttendance;
