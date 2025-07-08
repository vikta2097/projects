import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import '../styles/Notification.css';
import API_BASE_URL from '../api'; // e.g. 'http://localhost:3300/api'

// Initialize socket with autoConnect false to control connection manually
const socket = io('http://localhost:3300', { autoConnect: false });

const NotificationComponent = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, unread: 0 });
  const [filter, setFilter] = useState('all');
  const socketRef = useRef(socket);
  const dropdownRef = useRef(null);

  // Get auth token helper
  const getAuthToken = () => localStorage.getItem('token') || '';

  // Handle session expiry
  const handleSessionExpired = () => {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // Generic API call helper
  const apiCall = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      handleSessionExpired();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  };

  // Fetch notifications based on filter and role
  const fetchNotifications = useCallback(
    async (filterType = 'all') => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        const role = localStorage.getItem('role');
        if (role === 'admin') {
          params.append('all', 'true'); // admin sees all notifications
        }

        if (filterType === 'unread') {
          params.append('unread', 'true');
        } else if (filterType !== 'all') {
          params.append('type', filterType);
        }

        const response = await apiCall(`/notifications?${params.toString()}`);
        setNotifications(response.notifications || response);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch notification stats (total, unread)
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiCall('/notifications/stats');
      setStats(response);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = async (id) => {
    try {
      await apiCall(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications(filter);
      fetchStats();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      await apiCall(`/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications(filter);
      fetchStats();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Handle real-time notifications via socket.io
  useEffect(() => {
    const socketInstance = socketRef.current;

    if (!userId) return;

    socketInstance.connect();

    // Identify user to backend so it can map socket.id
    socketInstance.emit('identify', userId);

    // Listen for new notification events from backend
    socketInstance.on('new-notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      fetchStats();
    });

    // Also listen for system-wide notifications
    socketInstance.on('system-notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      fetchStats();
    });

    // Cleanup on unmount or userId change
    return () => {
      socketInstance.off('new-notification');
      socketInstance.off('system-notification');
      socketInstance.disconnect();
    };
  }, [userId, fetchStats]);

  // Fetch notifications and stats when filter changes or on mount
  useEffect(() => {
    fetchNotifications(filter);
    fetchStats();
  }, [filter, fetchNotifications, fetchStats]);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="notification-container" ref={dropdownRef}>
      <div
        className="notification-bell"
        onClick={() => setShowNotifications((prev) => !prev)}
        title="Notifications"
      >
        🔔
        {stats.unread > 0 && <span className="notification-count">{stats.unread}</span>}
      </div>

      {showNotifications && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <span>Notifications ({stats.total})</span>
            <div className="filter-options">
              <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={filter === 'unread' ? 'active' : ''}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('emergency')}
                className={filter === 'emergency' ? 'active' : ''}
              >
                Emergency
              </button>
              <button
                onClick={() => setFilter('dispatch')}
                className={filter === 'dispatch' ? 'active' : ''}
              >
                Dispatch
              </button>
              <button
                onClick={() => setFilter('system')}
                className={filter === 'system' ? 'active' : ''}
              >
                System
              </button>
            </div>
          </div>

          {loading ? (
            <div className="notification-loading">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">No notifications</div>
          ) : (
            <ul className="notification-list">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                >
                  <div className="notification-content">
                    <h4>{notif.title}</h4>
                    <p>{notif.message}</p>
                    <span className="notification-meta">
                      {notif.type} - Priority: {notif.priority} -{' '}
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="mark-read-btn"
                      >
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationComponent;
