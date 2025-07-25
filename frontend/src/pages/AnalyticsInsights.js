import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import "../styles/AnalyticsInsights.css";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

const AnalyticsInsights = () => {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await axios.get("http://localhost:3300/api/analytics/summary", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setInsights(res.data);
      } catch (err) {
        console.error("Error fetching AI insights:", err);
      }
    };

    fetchInsights();
  }, []);

  if (!insights) return <p>Loading insights...</p>;

  const attendanceData = [
    { name: "Late", count: insights.attendance.lateCount },
    { name: "On Time", count: insights.attendance.totalRecords - insights.attendance.lateCount },
  ];

  const leaveData = Object.entries(insights.leave.leaveTypeBreakdown || {}).map(([type, value]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value,
  }));

  return (
    <div className="analytics-page">
      <h2>AI-Powered Insights</h2>

      <div className="analytics-card">
        <h3>Attendance Summary</h3>
        <p>Total Records: {insights.attendance.totalRecords}</p>
        <p>Late Check-ins: {insights.attendance.lateCount}</p>
        <p>Average Hours Worked: {insights.attendance.averageHours} hrs</p>

        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={attendanceData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-card">
        <h3>Leave Summary</h3>
        <p>Total Requests: {insights.leave.totalRequests}</p>
        <p>Most Common Leave Type: {insights.leave.mostCommonType}</p>
        <p>Top Requester: {insights.leave.topRequester}</p>

        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={leaveData}
              cx="50%"
              cy="50%"
              label
              outerRadius={80}
              dataKey="value"
            >
              {leaveData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsInsights;
