import React, { useEffect, useState } from 'react'; 
import '../styles/MyAttendance.css';

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

  const checkIfMarkedToday = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/attendance/mine?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

  // Reverse geocode coordinates to human-readable address
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );
      if (!response.ok) throw new Error('Failed to reverse geocode');

      const data = await response.json();
      // The address field contains detailed info, you can pick the parts you want
      // For example: city, town, village, or display_name for full address
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
          // Get the human-readable location name
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
      const res = await fetch('/api/attendance/mine', {
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
