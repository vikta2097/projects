import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import '../styles/Notification.css';

const API_BASE_URL = 'http://localhost:3300';

const socket = io(API_BASE_URL, { autoConnect: false });

const NotificationComponent = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, unread: 0 });
  const [filter, setFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);

  const socketRef = useRef(socket);
  const dropdownRef = useRef(null);

  const getAuthToken = () => localStorage.getItem('token') || '';

  const handleSessionExpired = () => {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

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

  const fetchNotifications = useCallback(
    async (filterType = 'all') => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const role = localStorage.getItem('role');

        if (role === 'admin') {
          params.append('all', 'true');
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

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiCall('/notifications/stats');
      setStats(response);
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  }, []);

  const markAsRead = async (id) => {
    try {
      await apiCall(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications(filter);
      fetchStats();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await apiCall(`/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications(filter);
      fetchStats();
      if (selectedNotification?.id === id) setSelectedNotification(null);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Modal open/close handlers
  const openModal = (notification) => {
    setSelectedNotification(notification);
  };

  const closeModal = () => {
    setSelectedNotification(null);
  };

  // Format metadata for display
  const formatMetadata = (metadata) => {
    if (!metadata) return 'None';
    try {
      const obj = JSON.parse(metadata);
      return JSON.stringify(obj, null, 2);
    } catch {
      return metadata;
    }
  };

  useEffect(() => {
    const socketInstance = socketRef.current;
    if (!userId) return;

    socketInstance.connect();
    socketInstance.emit('identify', userId);

    socketInstance.on('new-notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      fetchStats();
    });

    socketInstance.on('system-notification', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      fetchStats();
    });

    return () => {
      socketInstance.off('new-notification');
      socketInstance.off('system-notification');
      socketInstance.disconnect();
    };
  }, [userId, fetchStats]);

  useEffect(() => {
    fetchNotifications(filter);
    fetchStats();
  }, [filter, fetchNotifications, fetchStats]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-container" ref={dropdownRef}>
      <div
        className="notification-bell"
        onClick={() => setShowNotifications((prev) => !prev)}
        title="Notifications"
        style={{ cursor: 'pointer' }}
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
              <button onClick={() => setFilter('unread')} className={filter === 'unread' ? 'active' : ''}>
                Unread
              </button>
              <button onClick={() => setFilter('emergency')} className={filter === 'emergency' ? 'active' : ''}>
                Emergency
              </button>
              <button onClick={() => setFilter('dispatch')} className={filter === 'dispatch' ? 'active' : ''}>
                Dispatch
              </button>
              <button onClick={() => setFilter('system')} className={filter === 'system' ? 'active' : ''}>
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
                  onClick={() => openModal(notif)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view details"
                >
                  <div className="notification-content">
                    <h4>{notif.title}</h4>
                    <p>
                      <strong>{notif.sender_name || 'Unknown'}</strong>: {notif.message.length > 50 ? notif.message.slice(0, 50) + '...' : notif.message}
                    </p>
                    <span className="notification-meta">
                      {notif.type} - Priority: {notif.priority} -{' '}
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                    {!notif.is_read && (
                      <button onClick={() => markAsRead(notif.id)} className="mark-read-btn">
                        Mark as Read
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif.id)} className="delete-btn">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              &times;
            </button>
            <h2>{selectedNotification.title}</h2>
            <p><strong>From:</strong> {selectedNotification.sender_name || 'Unknown'}</p>
            <p><strong>Type:</strong> {selectedNotification.type}</p>
            <p><strong>Priority:</strong> {selectedNotification.priority}</p>
            <p><strong>Date:</strong> {new Date(selectedNotification.created_at).toLocaleString()}</p>
            <p><strong>Message:</strong></p>
            <p>{selectedNotification.message}</p>
            <p><strong>Metadata:</strong></p>
            <pre className="metadata-pre">{formatMetadata(selectedNotification.metadata)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationComponent;
