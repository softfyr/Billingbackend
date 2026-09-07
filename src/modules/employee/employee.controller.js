import * as employeeService from './employee.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const handleCreateEmployee = asyncHandler(async (req, res) => {
  const result = await employeeService.createEmployee(req.tenantId, req.body);
  return ApiResponse.created(res, result, 'Employee registered successfully under store workspace.');
});

export const handleGetEmployees = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const employees = await employeeService.getEmployees(req.tenantId, search);
  return ApiResponse.success(res, employees, 'Employees list fetched successfully.');
});

export const handleGetEmployeeDetails = asyncHandler(async (req, res) => {
  const details = await employeeService.getEmployeeDetails(req.tenantId, req.params.id);
  return ApiResponse.success(res, details, 'Employee details fetched successfully.');
});

export const handleUpdateEmployee = asyncHandler(async (req, res) => {
  const updated = await employeeService.updateEmployee(req.tenantId, req.params.id, req.body);
  return ApiResponse.success(res, updated, 'Employee profile updated successfully.');
});

export const handleUpdateEmployeeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await employeeService.updateEmployeeStatus(req.tenantId, req.params.id, status);
  return ApiResponse.success(res, result, `Employee status updated to ${status}.`);
});

export const handleDeleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.tenantId, req.params.id);
  return ApiResponse.success(res, null, 'Employee account deleted successfully.');
});
