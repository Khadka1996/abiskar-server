// routes/clients.js
const express = require('express');
const router = express.Router();
const {
  validateClientData,
  validateClientId,
  validateBulkDelete,
} = require('../middlewares/clientMiddleware');
const {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  importClients,
  exportClients,
} = require('../controllers/clientController');

// Routes
router.get('/', getAllClients);
router.get('/:id', validateClientId, getClientById);
router.post('/', validateClientData, createClient);
router.put('/:id', validateClientId, validateClientData, updateClient);
router.delete('/:id', validateClientId, deleteClient);
router.delete('/', validateBulkDelete, bulkDeleteClients);
router.post('/import', importClients);
router.get('/export', exportClients);

module.exports = router;