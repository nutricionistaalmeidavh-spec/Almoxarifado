import { randomUUID } from 'node:crypto';
import { DomainError, requireId } from '../shared/domain-error.mjs';

function text(value, name) {
  const out = String(value ?? '').trim();
  if (!out) throw new DomainError('INVALID_INPUT', `${name} is required`, { field: name });
  return out;
}

export function createManagementService({ repository, idFactory = randomUUID } = {}) {
  if (!repository) throw new TypeError('repository is required');
  const save = (kind, input) => {
    const config = {
      costCenter: ['getCostCenter', 'saveCostCenter', 'listCostCenters'],
      project: ['getProject', 'saveProject', 'listProjects'],
      department: ['getDepartment', 'saveDepartment', 'listDepartments']
    }[kind];
    if (!config) throw new TypeError('invalid management kind');
    const [getter, saver, lister] = config;
    const id = input.id ? requireId(input.id, 'id') : idFactory();
    const previous = repository[getter](id) ?? {};
    const code = text(input.code ?? previous.code, 'code').toUpperCase();
    if (repository[lister]().some((item) => item.id !== id && String(item.code).toUpperCase() === code)) {
      throw new DomainError('MANAGEMENT_CODE_EXISTS', 'code already exists', { kind, code });
    }
    return repository[saver]({
      ...previous,
      id,
      code,
      name: text(input.name ?? previous.name, 'name'),
      active: input.active ?? previous.active ?? true,
      notes: String(input.notes ?? previous.notes ?? '').trim()
    });
  };
  return {
    saveCostCenter: (input) => save('costCenter', input),
    saveProject: (input) => save('project', input),
    saveDepartment: (input) => save('department', input)
  };
}
