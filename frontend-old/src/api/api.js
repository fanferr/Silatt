const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3000/api';

export const getAthletes = async () => {
    const res = await fetch(`${API_URL}/athletes`);
    return res.json();
};

export const getAthlete = async (id) => {
    const res = await fetch(`${API_URL}/athletes/${id}`);
    if (!res.ok) throw new Error('Failed to fetch athlete');
    return res.json();
};

export const registerAthlete = async (data) => {
    const res = await fetch(`${API_URL}/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
};

export const getLeaderboard = async () => {
    const res = await fetch(`${API_URL}/leaderboard`);
    return res.json();
};

export const startTest = async (athleteId) => {
    const res = await fetch(`${API_URL}/start-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId }),
    });
    return res.json();
};

export const stopTest = async () => {
    const res = await fetch(`${API_URL}/stop-test`, { method: 'POST' });
    return res.json();
};
