import type { WorkflowNode } from "./types";
import {
  isDependentParameterNode,
  getDependentParameterConfig,
  TOKEN_FORMAT,
} from "./dependentParametersConfig";

export interface FormFieldDef {
  variableName: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "multiselect" | "checkbox" | "date" | "time" | "datetime" | "url" | "file";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { label: string; value: string }[];
  description?: string;
  /** For file: allow multiple file selection when true */
  multiple?: boolean;
  /** When set to 'gdrive', show "Select from Google Drive" and fill input with selected file id/url */
  integrationSource?: "gdrive";
  /** Dependent parameter: show this field only when parent field has this value */
  dependsOn?: string;
  /** Value of dependsOn that triggers showing this field */
  showWhen?: string;
  /** API loader key for options (e.g. slackChannels, vercelProjects). Options loaded at runtime when backend supports it. */
  apiLoaderKey?: string;
  /** Static options for parent dropdown (e.g. "Create New Project" | "Existing Project") */
  parentOptions?: { label: string; value: string }[];
  /** Node id for scoping API loaders */
  nodeId?: string;
}

/** Extract variable name from ${variable} token pattern */
export function getTokenVarName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(TOKEN_FORMAT.PATTERN);
  return match?.[1]?.trim() ?? null;
}

/** Normalize token variable to form variable name (hyphens to underscores) */
function normalizeTokenVar(tokenVar: string): string {
  return tokenVar.trim().replace(/-/g, "_");
}

/** Node master ID for Google Picker form subNode (templates use this for Drive file/sheet selection) */
const GOOGLE_PICKER_NODE_MASTER_ID = "693033652e2a53befb19a1a7";

function isGooglePickerSubNode(name: string, subNodeMasterId?: string): boolean {
  const nameLower = (name || "").toLowerCase();
  if (nameLower.includes("google") && nameLower.includes("picker")) return true;
  if (typeof subNodeMasterId === "string" && subNodeMasterId === GOOGLE_PICKER_NODE_MASTER_ID) return true;
  return false;
}

/**
 * Extract run-tab fields from action nodes: parameters that use ${variable} tokens
 * and nodes with dependent parameter config (parent + conditional dependent params).
 */
function getRunTabFieldsFromNodes(
  nodes: WorkflowNode[] = [],
  existingVariableNames: Set<string>
): FormFieldDef[] {
  const fields: FormFieldDef[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const type = (node.type || "").toLowerCase();
    if (type === "form" || type === "form_input") continue;

    const nodeId = (node as { _id?: string })._id ?? "";
    const rawNodeMasterId = (node as { nodeMasterId?: string | object }).nodeMasterId;
    const nodeMasterId = typeof rawNodeMasterId === "string" ? rawNodeMasterId : "";

    const params = (node as { parameters?: Record<string, unknown> }).parameters ?? {};
    const isDependent = nodeMasterId && isDependentParameterNode(nodeMasterId);
    const dependentConfig = isDependent ? getDependentParameterConfig(nodeMasterId) : undefined;

    if (isDependent && dependentConfig) {
      const parentKey = dependentConfig.parentParamKey;
      const parentVarName = `${parentKey}_${nodeId}`;
      if (!seen.has(parentVarName)) {
        seen.add(parentVarName);
        const parentOptions: { label: string; value: string }[] =
          dependentConfig.dependentParams
            .filter((d) => d.dependsOnValue)
            .map((d) => ({ label: d.dependsOnValue!, value: d.dependsOnValue! }));
        if (parentOptions.length === 0) {
          parentOptions.push({ label: dependentConfig.parentParamLabel, value: "" });
        }
        fields.push({
          variableName: parentVarName,
          label: dependentConfig.parentParamLabel,
          type: "select",
          required: false,
          options: parentOptions.length ? parentOptions : undefined,
          ...(dependentConfig.parentApiLoaderKey
            ? { apiLoaderKey: dependentConfig.parentApiLoaderKey, nodeId }
            : {}),
        });
      }

      for (const dep of dependentConfig.dependentParams) {
        if (!dep.dependsOnValue) continue;
        const depVarName =
          dep.apiLoaderKey !== undefined
            ? `${parentVarName}__${dep.paramKey}__existing`
            : `${parentVarName}__${dep.paramKey}`;
        if (seen.has(depVarName)) continue;
        seen.add(depVarName);
        fields.push({
          variableName: depVarName,
          label: dep.paramLabel,
          type: dep.apiLoaderKey ? "select" : "text",
          required: false,
          placeholder: dep.apiLoaderKey ? "Select..." : undefined,
          dependsOn: parentVarName,
          showWhen: dep.dependsOnValue,
          ...(dep.apiLoaderKey ? { apiLoaderKey: dep.apiLoaderKey, nodeId } : {}),
        });
      }
    }

    for (const [paramKey, value] of Object.entries(params)) {
      const tokenVar = getTokenVarName(value);
      if (!tokenVar) continue;
      const variableName = normalizeTokenVar(tokenVar);
      if (existingVariableNames.has(variableName) || seen.has(variableName)) continue;
      seen.add(variableName);
      const label = variableName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      fields.push({
        variableName,
        label,
        type: "text",
        required: false,
      });
    }
  }

  return fields;
}

/**
 * Extract form field definitions from workflow nodes (form type with subNodes)
 * and run-tab fields from action nodes (dependent parameters + ${variable} tokens).
 */
export function getFormFieldsFromWorkflow(nodes: WorkflowNode[] = []): FormFieldDef[] {
  const fields: FormFieldDef[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const type = (node.type || "").toLowerCase();
    if (type !== "form" && type !== "form_input") continue;

    const subNodes = node.subNodes || [];
    for (const sub of subNodes) {
      const params = (sub as { parameters?: Record<string, unknown> }).parameters || {};
      const variableName = (params.variableName as string)?.trim?.() || (params.variableName as string);
      if (!variableName || seen.has(variableName)) continue;
      seen.add(variableName);

      const name = (sub as { name?: string }).name || "";
      const subNodeMasterId = (sub as { nodeMasterId?: string }).nodeMasterId;
      const inputLabel = (params.inputLabel as string) || variableName;
      const required = params.required === true;
      const placeholder = params.placeholder as string | undefined;
      const defaultValue = params.defaultValue as string | undefined;
      const description = params.description as string | undefined;
      const fieldTypeParam = (params.fieldType ?? params.type) as string | undefined;
      const nameLower = name.toLowerCase();

      const isGooglePicker = isGooglePickerSubNode(name, subNodeMasterId);

      let fieldType: FormFieldDef["type"] = "text";
      let multiple = false;

      if (isGooglePicker) {
        fieldType = "file";
        multiple = false;
      } else if (fieldTypeParam) {
        const ft = String(fieldTypeParam).toLowerCase();
        if (ft === "multipleselects" || ft === "multiple_selects" || ft === "multiselect") {
          fieldType = "multiselect";
        } else if (ft === "checklist" || ft === "check_list") {
          fieldType = "multiselect";
        } else if (ft === "singleselect" || ft === "single_select") {
          fieldType = "select";
        } else if (ft === "file" || ft === "fileupload") {
          fieldType = "file";
          multiple = params.multiple === true || params.allowMultiple === true;
        }
      }

      if (fieldType === "text") {
        if (nameLower.includes("multiple") && nameLower.includes("select")) {
          fieldType = "multiselect";
        } else if (nameLower.includes("checklist") || nameLower === "check list") {
          fieldType = "multiselect";
        } else if (nameLower.includes("select")) {
          fieldType = "select";
        } else if (nameLower.includes("date") || nameLower.includes("time")) {
          const formatType = (params.formatType as string) || "";
          if (formatType === "time") fieldType = "time";
          else if (formatType === "date") fieldType = "date";
          else fieldType = "datetime";
        } else if (nameLower.includes("number")) {
          fieldType = "number";
        } else if (nameLower.includes("textarea") || nameLower.includes("long")) {
          fieldType = "textarea";
        } else if (nameLower.includes("url")) {
          fieldType = "url";
        } else if (nameLower.includes("file") || nameLower.includes("upload")) {
          fieldType = "file";
          multiple = params.multiple === true || params.allowMultiple === true;
        }
      }

      let options: FormFieldDef["options"];
      const rawOptions = params.options as string[] | undefined;
      const optionsSingle = (params.options as Record<string, unknown>)?.singleSelect as string | undefined;
      const optionsMultiple = (params.options as Record<string, unknown>)?.multipleSelects as string | undefined;
      if (Array.isArray(rawOptions) && rawOptions.length) {
        options = rawOptions.map((o) => (typeof o === "string" ? { label: o, value: o } : { label: String(o), value: String(o) }));
      } else if (optionsMultiple && typeof optionsMultiple === "string") {
        options = optionsMultiple.split(/[\n,]+/).map((s) => ({ label: s.trim(), value: s.trim() })).filter((o) => o.value);
      } else if (optionsSingle && typeof optionsSingle === "string") {
        options = optionsSingle.split(/[\n,]+/).map((s) => ({ label: s.trim(), value: s.trim() })).filter((o) => o.value);
      }

      const integrationSource = (params.integrationSource ?? params.sourceIntegration) as string | undefined;
      const gdriveSource =
        isGooglePicker || integrationSource?.toLowerCase() === "gdrive"
          ? ("gdrive" as const)
          : undefined;

      fields.push({
        variableName,
        label: inputLabel,
        type: fieldType,
        required,
        placeholder,
        defaultValue,
        options,
        description,
        ...(fieldType === "file" ? { multiple } : {}),
        ...(gdriveSource ? { integrationSource: gdriveSource } : {}),
      });
    }
  }

  const formVariableNames = new Set(fields.map((f) => f.variableName));
  const runTabFields = getRunTabFieldsFromNodes(nodes, formVariableNames);
  return [...fields];
}
