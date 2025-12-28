const Client = require('../models/clientModel');
const Papa = require('papaparse');

// Get all clients
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Server error: Unable to fetch clients' });
  }
};

// Get a single client by ID
const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Server error: Unable to fetch client' });
  }
};

// Create a client
const createClient = async (req, res) => {
  try {
    const client = new Client({
      ...req.body,
      project: {
        ...req.body.project,
        deadline: new Date(req.body.project.deadline), // Ensure deadline is a Date
      },
    });
    const newClient = await client.save();
    res.status(201).json(newClient);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(400).json({ message: 'Failed to create client: ' + err.message });
  }
};

// Update a client
const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    Object.assign(client, {
      ...req.body,
      project: {
        ...req.body.project,
        deadline: new Date(req.body.project.deadline), // Ensure deadline is a Date
      },
    });
    const updatedClient = await client.save();
    res.json(updatedClient);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(400).json({ message: 'Failed to update client: ' + err.message });
  }
};

// Delete a client
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    await client.deleteOne();
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error: Unable to delete client' });
  }
};

// Bulk delete clients
const bulkDeleteClients = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await Client.deleteMany({ _id: { $in: ids } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No clients found to delete' });
    }
    res.json({ message: `${result.deletedCount} clients deleted successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server error: Unable to delete clients' });
  }
};

// Import clients from CSV
const importClients = async (req, res) => {
  try {
    const csvData = req.body.csv; // Assume CSV data is sent in body
    if (!csvData) {
      return res.status(400).json({ message: 'CSV data is required' });
    }
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
    const clients = parsed.map((row) => ({
      name: row.name,
      email: row.email,
      phone: row.phone,
      country: row.country,
      project: {
        name: row.projectName,
        description: row.projectDescription || '',
        completed: row.completed === 'true',
        deadline: new Date(row.deadline),
        progress: Number(row.progress),
        budget: Number(row.budget),
      },
    }));

    // Validate parsed data
    for (const client of clients) {
      if (!client.name || !client.email || !client.phone || !client.country || !client.project.name ||
          !client.project.deadline || client.project.progress == null || client.project.budget == null) {
        return res.status(400).json({ message: 'Invalid CSV data: Missing required fields' });
      }
      if (!validator.isEmail(client.email)) {
        return res.status(400).json({ message: `Invalid email in CSV: ${client.email}` });
      }
      if (client.project.progress < 0 || client.project.progress > 100) {
        return res.status(400).json({ message: `Invalid progress in CSV: ${client.project.progress}` });
      }
      if (client.project.budget < 0) {
        return res.status(400).json({ message: `Invalid budget in CSV: ${client.project.budget}` });
      }
      if (!validator.isDate(client.project.deadline.toString())) {
        return res.status(400).json({ message: `Invalid deadline in CSV: ${client.project.deadline}` });
      }
    }

    await Client.insertMany(clients);
    res.json({ message: `${clients.length} clients imported successfully` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'One or more emails already exist' });
    }
    res.status(400).json({ message: 'Failed to import clients: ' + err.message });
  }
};

// Export clients as CSV
const exportClients = async (req, res) => {
  try {
    const clients = await Client.find();
    const csv = Papa.unparse(clients.map((client) => ({
      name: client.name,
      email: client.email,
      phone: client.phone,
      country: client.country,
      projectName: client.project.name,
      projectDescription: client.project.description,
      completed: client.project.completed,
      deadline: client.project.deadline,
      progress: client.project.progress,
      budget: client.project.budget,
    })));
    res.header('Content-Type', 'text/csv');
    res.attachment('clients.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error: Unable to export clients' });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  importClients,
  exportClients,
};