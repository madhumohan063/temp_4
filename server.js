const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Get the API key from environment variables

// Serve your static files (index.html, etc.)
app.use(express.static(path.join(__dirname)));

// Endpoint for geocoding API
app.get('/geocode', (req, res) => {
  const address = req.query.address; // Get address from the query string

  axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
    params: {
      address: address,
      key: API_KEY
    }
  })
  .then(response => {
    if (response.data.status === 'OK') {
      res.json(response.data);  // Send geocoding data to the client
    } else {
      res.status(400).json({ error: response.data.error_message || 'Geocoding failed' });
    }
  })
  .catch(error => {
    console.error('Error fetching geocode:', error);
    res.status(500).json({ error: 'Something went wrong while fetching geocode' });
  });
});

// Serve the HTML file when visiting the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
