import React, { useEffect, useState } from 'react';
import '../styles/MyAttendance.css';
import API_BASE_URL from '../api';

function MyAttendance() {
  const [statusMessage, setStatusMessage] = useState('');
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [checkInLocation, setCheckInLocation] = useState('');
  const [checkOutLocation, setCheckOutLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [onLeave, setOnLeave] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchUserLocation();
    checkIfOnLeave();
    checkIfMarkedToday();
  }, []);

  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async position => {
          const { latitude, longitude } = position.coords;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await response.json();

            const placeName = data.address?.city
              ? `${data.address.city}, ${data.address.country}`
              : data.display_name || `${latitude}, ${longitude}`;

            setCheckInLocation(placeName);
            setCheckOutLocation(placeName);
          } catch (error) {
            console.error('Geocoding failed:', error);
            const fallback = `${latitude}, ${longitude}`;
            setCheckInLocation(fallback);
            setCheckOutLocation(fallback);
          }
        },
        () => {
          setCheckInLocation('Location unavailable');
          setCheckOutLocation('Location unavailable');
        }
      );
    } else {
      setCheckInLocation('Geolocation not supported');
      setCheckOutLocation('Geolocation not supported');
    }
  };

  const handleSessionExpired = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const checkIfOnLeave = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/leaves/today`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) return handleSessionExpired();

      const data = await res.json();
      if (data.onLeave) {
        setOnLeave(true);
        setStatusMessage('📅 You are on approved leave today.');
      }
    } catch (err) {
      console.error('Error checking leave status:', err);
    }
  };

  const checkIfMarkedToday = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/attendance/mine?date=${today}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) return handleSessionExpired();

      if (res.status === 200) {
        const data = await res.json();
        if (data.marked) {
          setAlreadyMarked(true);
          setAttendanceData(data);
          setCheckedOut(!!data.check_out);
          const checkInTime = formatTime(data.check_in);
          const checkOutTime = data.check_out ? formatTime(data.check_out) : '';
          setStatusMessage(
            `✅ You checked in at ${checkInTime}${checkOutTime ? ` and out at ${checkOutTime}` : ''}.`
          );
        }
      }
    } catch (err) {
      console.error('Error checking today attendance:', err);
    }
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    const date = new Date(`1970-01-01T${timeString}Z`);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/attendance/mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ check_in_location: checkInLocation }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage('✅ Attendance marked successfully.');
        setAlreadyMarked(true);
        checkIfMarkedToday();
      } else {
        setStatusMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setStatusMessage('❌ Error marking attendance.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (checkedOut) {
      setStatusMessage('⚠️ You have already checked out today.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/attendance/mine/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ check_out_location: checkOutLocation }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage('✅ Checked out successfully.');
        setCheckedOut(true);
        checkIfMarkedToday();
      } else {
        setStatusMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setStatusMessage('❌ Unexpected error during checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attendance-card">
      <h2>🕘 My Attendance</h2>

      {onLeave ? (
        <div className="status-message error">{statusMessage}</div>
      ) : (
        <>
          {statusMessage && (
            <div className={`status-message ${checkedOut ? 'success' : alreadyMarked ? 'success' : 'error'}`}>
              {statusMessage}
            </div>
          )}

          <div className="attendance-info">
            {alreadyMarked && (
              <>
                {attendanceData?.check_in && (
                  <p>
                    📍 <strong>Check-in Location:</strong> {attendanceData.check_in_location || checkInLocation}
                  </p>
                )}
                {attendanceData?.check_out && (
                  <p>
                    📍 <strong>Check-out Location:</strong> {attendanceData.check_out_location || checkOutLocation}
                  </p>
                )}
                {attendanceData?.worked_hours && (
                  <p className="worked-hours">
                    🕒 Worked Hours: {Number(attendanceData.worked_hours).toFixed(2)}
                  </p>
                )}
              </>
            )}

            {!alreadyMarked && (
              <p>
                📍 <strong>Current Check-in Location:</strong> {checkInLocation || 'Fetching...'}
              </p>
            )}

            {!checkedOut && alreadyMarked && (
              <p>
                📍 <strong>Current Check-out Location:</strong> {checkOutLocation || 'Fetching...'}
              </p>
            )}
          </div>

          {!alreadyMarked ? (
            <button className="attendance-button" onClick={handleCheckIn} disabled={loading}>
              {loading ? 'Marking...' : 'Check In'}
            </button>
          ) : !checkedOut ? (
            <button className="attendance-button" onClick={handleCheckOut} disabled={loading}>
              {loading ? 'Checking out...' : 'Check Out'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default MyAttendance;
