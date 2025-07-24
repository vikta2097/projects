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
        position => {
          const locationStr = `${position.coords.latitude}, ${position.coords.longitude}`;
          setCheckInLocation(locationStr);
          setCheckOutLocation(locationStr);
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
          setStatusMessage(
            `✅ You checked in at ${data.check_in}${
              data.check_out ? ` and out at ${data.check_out}` : ''
            }.`
          );
        }
      }
    } catch (err) {
      console.error('Error checking today attendance:', err);
    }
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
        checkIfMarkedToday(); // Refresh attendance data
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
        checkIfMarkedToday(); // Refresh attendance data
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
    <div className="my-attendance-container">
      <h2>🕘 My Attendance</h2>

      {onLeave ? (
        <div className="status-message leave">{statusMessage}</div>
      ) : alreadyMarked ? (
        <div>
          <div className="status-message success">{statusMessage}</div>
          {attendanceData?.worked_hours && (
            <p className="worked-hours">
              🕒 Worked Hours: {Number(attendanceData.worked_hours).toFixed(2)}
            </p>
          )}
          {!checkedOut && (
            <button className="attendance-button" onClick={handleCheckOut} disabled={loading}>
              {loading ? 'Checking out...' : 'Check Out'}
            </button>
          )}
        </div>
      ) : (
        <>
          <button className="attendance-button" onClick={handleCheckIn} disabled={loading}>
            {loading ? 'Marking...' : 'Check In'}
          </button>
          {statusMessage && <div className="status-message error">{statusMessage}</div>}
        </>
      )}
    </div>
  );
}

export default MyAttendance;
