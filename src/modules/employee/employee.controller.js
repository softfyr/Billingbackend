import * as employeeService from './employee.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreateEmployee = asyncHandler(async (req, res) => {
  const result = await employeeService.createEmployee(req.tenantId, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Employee registered successfully under store workspace.'));
});

export const handleGetEmployees = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const employees = await employeeService.getEmployees(req.tenantId, search);
  return res.status(200).json(new ApiResponse(200, employees, 'Employees list fetched successfully.'));
});

export const handleGetEmployeeDetails = asyncHandler(async (req, res) => {
  const details = await employeeService.getEmployeeDetails(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, details, 'Employee details fetched successfully.'));
});

export const handleUpdateEmployee = asyncHandler(async (req, res) => {
  const updated = await employeeService.updateEmployee(req.tenantId, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, updated, 'Employee profile updated successfully.'));
});

export const handleUpdateEmployeeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await employeeService.updateEmployeeStatus(req.tenantId, req.params.id, status);
  return res.status(200).json(new ApiResponse(200, result, `Employee status updated to ${status}.`));
});

export const handleDeleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.tenantId, req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Employee account deleted successfully.'));
});
