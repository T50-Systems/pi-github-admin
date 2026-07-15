export interface WorkflowValidationResult {
  errors: string[];
  files: string[];
}

export function validateWorkflowFile(
  file: string,
  root?: string,
): Promise<string[]>;

export function discoverWorkflowFiles(root?: string): Promise<string[]>;

export function validateWorkflows(
  root?: string,
): Promise<WorkflowValidationResult>;
