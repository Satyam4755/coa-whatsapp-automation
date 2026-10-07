import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  MdAdd,
  MdCode,
  MdDelete,
  MdFormatBold,
  MdFormatItalic,
  MdFormatStrikethrough,
  MdGroups,
  MdSync,
  MdVisibility,
} from "react-icons/md";
import { FiSearch, FiX } from "react-icons/fi";
import { BeatLoader } from "react-spinners";
import { toast } from "sonner";
import { z } from "zod";
import api from "../../../services/api";
import { useUploadHeaderImageMutation } from "../../../store/apiSlice";
import { getSelectedUsers } from "../../../utils/selectedUsers";
import { Card } from "../../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import TemplateMobilePreview from "./TemplateMobilePreview";

const suggestions = [
  "Email",
  "Mobile",
  "archName",
  "archRegNum",
  "archValidityUpTo",
  "archdob",
];

const headerTypes = [
  { value: "NONE", label: "No Header" },
  { value: "TEXT", label: "Text" },
  { value: "IMAGE", label: "Image" },
];

const buttonTypes = [
  { value: "QUICK_REPLY", label: "Quick reply" },
  { value: "URL", label: "Website URL" },
  { value: "PHONE_NUMBER", label: "Phone number" },
];

const createEmptyButton = () => ({
  type: "QUICK_REPLY",
  text: "",
  url: "",
  phone_number: "",
});

const textFormatActions = [
  { id: "bold", label: "Bold", icon: MdFormatBold, marker: "*" },
  { id: "italic", label: "Italic", icon: MdFormatItalic, marker: "_" },
  { id: "strike", label: "Strikethrough", icon: MdFormatStrikethrough, marker: "~" },
  { id: "mono", label: "Monospace", icon: MdCode, marker: "```" },
];

const templateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .regex(
      /^[a-z][a-z_]*$/,
      "Template name must start with a lower-case letter and contain only lower-case letters and underscores."
    ),
  category: z.enum(["AUTHENTICATION", "MARKETING", "UTILITY"]),
  language: z
    .string()
    .trim()
    .min(1, "Language is required.")
    .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/, "Use Meta language format, for example en_US."),
});

// Helper to preview message with sample data
function previewMessage(text, variableMap, sampleData) {
  let preview = text;
  Object.entries(variableMap).forEach(([idx, name]) => {
    const regex = new RegExp(`\\{\\{${idx}\\}\\}`, "g");
    preview = preview.replace(regex, sampleData[name] || `[${name}]`);
  });
  return preview;
}

// WhatsApp template parameter validation
function validateWhatsAppTemplate(text) {
  const errors = [];
  const regex = /\{\{(\d+)\}\}/g;
  const matches = [...text.matchAll(regex)];
  const numbers = matches.map((m) => parseInt(m[1]));

  // Ensure variables are sequential: {{1}}, {{2}}, ...
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      errors.push("Variables must be sequential: {{1}}, {{2}}, ...");
      break;
    }
  }

  // Message must not end with a variable
  if (/\{\{\d+\}\}\s*$/.test(text)) {
    errors.push("The message cannot end with a variable.");
  }

  // Mismatched curly braces
  const open = (text.match(/\{\{/g) || []).length;
  const close = (text.match(/\}\}/g) || []).length;
  if (open !== close) {
    errors.push("Mismatched curly braces in variables.");
  }

  // Short message warning
  if (text.length < 20 && numbers.length > 2) {
    errors.push(
      "Too many variables for a short message. Reduce variables or add more context."
    );
  }

  return errors;
}

function normalizeTemplateName(name = "") {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTemplateNameInput(name = "") {
  return name.toLowerCase().replace(/[^a-z_]+/g, "_");
}

function getTemplateStatusMeta(status) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return {
        label: "Approved",
        className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      };
    case "PENDING":
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
      };
    case "MISSING_ON_META":
      return {
        label: "Missing on Meta",
        className: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
      };
    case "PAUSED":
      return {
        label: "Paused",
        className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
      };
    default:
      return {
        label: status || "Draft",
        className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
      };
  }
}

const sampleArchitect = {
  Email: "sample@email.com",
  Mobile: "9876543210",
  archName: "Sample Name",
  archRegNum: "CA/2022/123456",
  archValidityUpTo: "31/December/2030",
  archdob: "1990-01-01",
};

const MessageTemplates = ({ onSelectScheduleTemplate, onNavigateToArchitects }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedScheduleTemplateId, setSelectedScheduleTemplateId] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState("");
  const [debouncedTemplateSearchTerm, setDebouncedTemplateSearchTerm] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("");
  const [templateStatusFilter, setTemplateStatusFilter] = useState("");
  const [templateLanguageFilter, setTemplateLanguageFilter] = useState("");
  const formRef = useRef(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "",
      },
    ],
    variableMap: {},
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const {
    control,
    register,
    setValue,
    trigger,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(templateFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      category: "UTILITY",
      language: "en_US",
    },
  });
  const messageRef = useRef();
  const [updateLoaderActive, setUpdateLoaderActive] = useState(false);
  const [addLoaderActive, setAddLoaderActive] = useState(false);
  const [syncLoaderActive, setSyncLoaderActive] = useState(false);
  const [uploadHeaderImage] = useUploadHeaderImageMutation();
  const users = getSelectedUsers();
  const [headerType, setHeaderType] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [headerImagePreviewUrl, setHeaderImagePreviewUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [bodyVariableSamples, setBodyVariableSamples] = useState({});
  const isFormOpen = isCreatingNew || selectedTemplate;
  const templateLanguageOptions = Array.from(
    new Set(templates.map((template) => template.language).filter(Boolean))
  ).sort();
  const filteredTemplates = templates.filter((template) => {
    const query = debouncedTemplateSearchTerm.trim().toLowerCase();
    const searchableText = [
      template.name,
      template.category,
      template.language,
      template.status,
      template.rejection_reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchableText.includes(query)) &&
      (!templateCategoryFilter || template.category === templateCategoryFilter) &&
      (!templateStatusFilter || template.status === templateStatusFilter) &&
      (!templateLanguageFilter || template.language === templateLanguageFilter)
    );
  });
  const hasTemplateFilters =
    Boolean(debouncedTemplateSearchTerm.trim()) ||
    Boolean(templateCategoryFilter) ||
    Boolean(templateStatusFilter) ||
    Boolean(templateLanguageFilter);
  const hasSelectedArchitects = users.length > 0;
  const hasSelectedScheduleTemplate = Boolean(selectedScheduleTemplateId);
  const templateStatusCounts = {
    ALL: templates.length,
    APPROVED: templates.filter((template) => template.status === "APPROVED").length,
    PENDING: templates.filter((template) => template.status === "PENDING").length,
    REJECTED: templates.filter((template) => template.status === "REJECTED").length,
    MISSING_ON_META: templates.filter((template) => template.status === "MISSING_ON_META").length,
  };

  const getAllTemplate = async () => {
    try {
      const res = await api.get("/template");
      setTemplates(res?.data?.templates || []);
    } catch {
      toast.error("Failed to fetch templates");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTemplateSearchTerm(templateSearchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [templateSearchTerm]);

  const syncFormFields = (template) => {
    setValue("name", template.name || "", { shouldValidate: false });
    setValue("category", template.category || "UTILITY", { shouldValidate: false });
    setValue("language", template.language || "en_US", { shouldValidate: false });
    clearErrors(["name", "category", "language"]);
  };

  const buildTemplateComponents = (components) => {
    const bodyComponent = components.find((component) => component.type === "BODY") || {
      type: "BODY",
      text: "",
    };
    const nextComponents = [];

    if (headerType === "TEXT" && headerText.trim()) {
      nextComponents.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
    }

    if (headerType === "IMAGE" && headerImageUrl.trim()) {
      nextComponents.push({
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: headerImageUrl.trim(),
          ...(headerImagePreviewUrl ? { preview_url: headerImagePreviewUrl } : {}),
        },
      });
    }

    nextComponents.push(bodyComponent);

    if (footerText.trim()) {
      nextComponents.push({ type: "FOOTER", text: footerText.trim() });
    }

    const cleanButtons = buttons
      .map((button) => ({
        type: button.type,
        text: button.text.trim(),
        ...(button.type === "URL" ? { url: button.url.trim() } : {}),
        ...(button.type === "PHONE_NUMBER"
          ? { phone_number: button.phone_number.trim() }
          : {}),
      }))
      .filter((button) => {
        if (!button.text) return false;
        if (button.type === "URL") return Boolean(button.url);
        if (button.type === "PHONE_NUMBER") return Boolean(button.phone_number);
        return button.type === "QUICK_REPLY";
      });

    if (cleanButtons.length > 0) {
      nextComponents.push({ type: "BUTTONS", buttons: cleanButtons });
    }

    return nextComponents;
  };

  const resetTemplateEditor = () => {
    const template = {
      name: "",
      category: "UTILITY",
      language: "en_US",
      components: [
        {
          type: "BODY",
          text: "",
        },
      ],
      variableMap: {},
    };

    setNewTemplate(template);
    syncFormFields(template);
    setHeaderType("NONE");
    setHeaderText("");
    setHeaderImageUrl("");
    setHeaderImagePreviewUrl("");
    setFooterText("");
    setButtons([]);
    setBodyVariableSamples({});
    setValidationErrors([]);
  };

  const handleNewTemplateClick = () => {
    setIsCreatingNew(true);
    setSelectedTemplate(null);
    resetTemplateEditor();
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleContentChange = (e) => {
    const value = e.target.value;
    const inputType = e.nativeEvent?.inputType || "";
    const insertedText = e.nativeEvent?.data || "";

    // Block manually typed braces, but allow backspace/delete around generated variables.
    if (inputType.startsWith("insert") && /[{}]/.test(insertedText)) {
      return;
    }

    setNewTemplate((prev) => {
      // Update the BODY component by type, not by index
      const newComponents = prev.components.map((c) =>
        c.type === "BODY" ? { ...c, text: value } : c
      );
      return {
        ...prev,
        components: newComponents,
      };
    });
    setShowSuggestions(false);
    setValidationErrors(validateWhatsAppTemplate(value));
  };

  const updateBodyText = (value) => {
    setNewTemplate((prev) => ({
      ...prev,
      components: prev.components.map((component) =>
        component.type === "BODY" ? { ...component, text: value } : component
      ),
    }));
    setValidationErrors(validateWhatsAppTemplate(value));
  };

  const applyMessageFormat = (action) => {
    const textarea = messageRef.current;
    if (!textarea) return;

    const bodyText =
      newTemplate.components.find((component) => component.type === "BODY")?.text || "";
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    const selectedText = bodyText.slice(selectionStart, selectionEnd) || "text";
    const formattedText = `${action.marker}${selectedText}${action.marker}`;
    const nextText = `${bodyText.slice(0, selectionStart)}${formattedText}${bodyText.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + action.marker.length;
    const nextSelectionEnd = nextSelectionStart + selectedText.length;

    updateBodyText(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    }, 0);
  };

  const handleSuggestionClick = (suggestion) => {
    const usedNumbers = Object.keys(newTemplate.variableMap).map(Number);
    let nextNum = 1;
    while (usedNumbers.includes(nextNum)) nextNum++;

    const cursorPosition = messageRef.current.selectionStart;
    const text =
      newTemplate.components.find((c) => c.type === "BODY")?.text || "";
    const contentBeforeCursor = text.slice(0, cursorPosition);
    const contentAfterCursor = text.slice(cursorPosition);
    const newText = `${contentBeforeCursor}{{${nextNum}}}${contentAfterCursor}`;

    const newVariableMap = {
      ...newTemplate.variableMap,
      [nextNum]: suggestion,
    };

    setNewTemplate((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.type === "BODY" ? { ...c, text: newText } : c
      ),
      variableMap: newVariableMap,
    }));

    setShowSuggestions(false);
    setTimeout(() => {
      if (messageRef.current) messageRef.current.focus();
    }, 0);
    setValidationErrors(validateWhatsAppTemplate(newText));
  };

  const handleBodySampleChange = (idx, value) => {
    setBodyVariableSamples((prev) => ({ ...prev, [idx]: value }));
  };

  const buildBodyExample = () => {
    const bodyComp = newTemplate.components.find((c) => c.type === "BODY");
    if (!bodyComp) return undefined;
    const matches = [...(bodyComp.text || "").matchAll(/\{\{(\d+)\}\}/g)];
    const numbers = matches.map((m) => parseInt(m[1]));
    const maxVar = Math.max(0, ...numbers);
    const arr = [];
    for (let i = 1; i <= maxVar; i++) {
      arr.push(bodyVariableSamples[i] || "Sample");
    }
    return arr.length ? { body_text: [arr] } : undefined;
  };

  const validateButtons = () => {
    if (buttons.length > 3) {
      return "Use at most 3 buttons for this template editor.";
    }

    for (const button of buttons) {
      if (!button.text.trim()) return "Every button needs button text.";
      if (button.text.trim().length > 25) {
        return "Button text must be 25 characters or less.";
      }
      if (button.type === "URL" && !/^https:\/\/.+/i.test(button.url.trim())) {
        return "URL buttons must use a valid https:// URL.";
      }
      if (
        button.type === "PHONE_NUMBER" &&
        !/^\+?[1-9]\d{7,14}$/.test(button.phone_number.trim())
      ) {
        return "Phone number buttons must use international format, for example +919876543210.";
      }
    }

    return null;
  };

  const handleTemplateNameChange = (value) => {
    const normalizedName = normalizeTemplateNameInput(value);
    setNewTemplate((prev) => ({ ...prev, name: normalizedName }));
    setValue("name", normalizedName, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleTemplateCategoryChange = (value) => {
    setNewTemplate((prev) => ({ ...prev, category: value }));
    setValue("category", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleTemplateLanguageChange = (value) => {
    setNewTemplate((prev) => ({ ...prev, language: value.trim() }));
    setValue("language", value.trim(), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleTemplateSave = async () => {
    setAddLoaderActive(true);
    const normalizedName = normalizeTemplateName(newTemplate.name);
    if (normalizedName !== newTemplate.name) {
      setNewTemplate((prev) => ({ ...prev, name: normalizedName }));
      setValue("name", normalizedName, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    const { category, language, components, variableMap } = newTemplate;
    const name = normalizedName;
    if (
      !name ||
      !category ||
      !language ||
      !components.find((c) => c.type === "BODY")?.text
    ) {
      setAddLoaderActive(false);
      return toast.error("All fields are required!");
    }
    const isFormValid = await trigger(["name", "category", "language"]);
    if (!isFormValid) {
      setAddLoaderActive(false);
      return toast.error("Please fix template form errors before saving.");
    }
    if (validationErrors.length > 0) {
      setAddLoaderActive(false);
      return toast.error("Please fix template errors before saving.");
    }
    const buttonError = validateButtons();
    if (buttonError) {
      setAddLoaderActive(false);
      return toast.error(buttonError);
    }
    try {
      const templateComponents = buildTemplateComponents(components);
      const comps = templateComponents.map((c) => {
        if (c.type === "BODY") {
          return { ...c, example: buildBodyExample() };
        }
        return c;
      });
      const payload = { ...newTemplate, name, components: comps, variableMap };
      const res = await api.post("/template", payload);
      if (res?.data?.success) {
        toast.success("Template created successfully");
        setTemplates((prev) => [res.data.template, ...prev]);
        await getAllTemplate();
        setIsCreatingNew(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create template");
    } finally {
      setAddLoaderActive(false);
    }
  };

  const handleUpdateTemplate = async (id) => {
    setUpdateLoaderActive(true);
    const normalizedName = normalizeTemplateName(newTemplate.name);
    if (normalizedName !== newTemplate.name) {
      setNewTemplate((prev) => ({ ...prev, name: normalizedName }));
      setValue("name", normalizedName, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    const { category, language, components, variableMap } = newTemplate;
    const name = normalizedName;
    if (
      !name ||
      !category ||
      !language ||
      !components.find((c) => c.type === "BODY")?.text
    ) {
      setUpdateLoaderActive(false);
      return toast.error("All fields are required!");
    }
    const isFormValid = await trigger(["name", "category", "language"]);
    if (!isFormValid) {
      setUpdateLoaderActive(false);
      return toast.error("Please fix template form errors before updating.");
    }
    if (validationErrors.length > 0) {
      setUpdateLoaderActive(false);
      return toast.error("Please fix template errors before updating.");
    }
    const buttonError = validateButtons();
    if (buttonError) {
      setUpdateLoaderActive(false);
      return toast.error(buttonError);
    }
    try {
      const templateComponents = buildTemplateComponents(components);
      const comps = templateComponents.map((c) => {
        if (c.type === "BODY") {
          return { ...c, example: buildBodyExample() };
        }
        return c;
      });
      const payload = { ...newTemplate, name, components: comps, variableMap };
      const res = await api.put(`/template/${id}`, payload);
      if (res?.data?.success) {
        toast.success("Template updated successfully");
        setTemplates((prev) =>
          prev.map((template) =>
            template._id === res.data.template._id ? res.data.template : template
          )
        );
        await getAllTemplate();
        setSelectedTemplate(res.data.template);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update template");
    } finally {
      setUpdateLoaderActive(false);
    }
  };

  const handleTemplateSelect = async (id) => {
    try {
      const res = await api.get(`/template/${id}`);
      setSelectedTemplate(res?.data?.template);
      const headerComp = (res?.data?.template?.components || []).find(
        (c) => c.type === "HEADER"
      );
      const footerComp = (res?.data?.template?.components || []).find(
        (c) => c.type === "FOOTER"
      );
      const buttonsComp = (res?.data?.template?.components || []).find(
        (c) => c.type === "BUTTONS"
      );
      if (!headerComp) {
        setHeaderType("NONE");
        setHeaderText("");
        setHeaderImageUrl("");
        setHeaderImagePreviewUrl("");
      } else if (headerComp.format === "TEXT") {
        setHeaderType("TEXT");
        setHeaderText(headerComp.text || "");
        setHeaderImageUrl("");
        setHeaderImagePreviewUrl("");
      } else if (headerComp.format === "IMAGE") {
        setHeaderType("IMAGE");
        setHeaderText("");
        setHeaderImageUrl(headerComp.example?.header_handle?.[0] || "");
        setHeaderImagePreviewUrl(headerComp.example?.preview_url || "");
      }
      setFooterText(footerComp?.text || "");
      setButtons(buttonsComp?.buttons || []);
      const templateFormValue = {
        name: res?.data?.template?.name,
        category: res?.data?.template?.category,
        language: res?.data?.template?.language,
        components: res?.data?.template?.components,
        variableMap: res?.data?.template?.variableMap || {},
      };
      setNewTemplate(templateFormValue);
      syncFormFields(templateFormValue);
      setIsCreatingNew(false);
      setValidationErrors(
        validateWhatsAppTemplate(
          res?.data?.template?.components?.find((c) => c.type === "BODY")
            ?.text || ""
        )
      );
      let samples = {};
      const bodyComp = (res?.data?.template?.components || []).find(
        (c) => c.type === "BODY"
      );
      if (
        bodyComp &&
        bodyComp.example &&
        Array.isArray(bodyComp.example.body_text?.[0])
      ) {
        bodyComp.example.body_text[0].forEach((val, idx) => {
          samples[idx + 1] = val;
        });
      }
      setBodyVariableSamples(samples);
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch {
      toast.error("Failed to fetch template");
    }
  };

  const handleTemplatePreviewSelect = (id) => {
    setSelectedScheduleTemplateId(id);
    onSelectScheduleTemplate?.(id);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.delete(`/template/${id}`);
      if (res?.data?.success) {
        toast.success("Template deleted successfully!");
        setTemplates((prev) => prev.filter((template) => template._id !== id));
        await getAllTemplate();
        if (selectedTemplate?._id === id) {
          setSelectedTemplate(null);
          resetTemplateEditor();
        }
        if (selectedScheduleTemplateId === id) {
          setSelectedScheduleTemplateId("");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete template");
    }
  };

  const previewText = previewMessage(
    newTemplate.components.find((c) => c.type === "BODY")?.text || "",
    newTemplate.variableMap || {},
    sampleArchitect
  );

  const previewHeaderImage =
    headerImagePreviewUrl ||
    (newTemplate.components || []).find((component) => component.type === "HEADER")
      ?.example?.preview_url ||
    "";
  const previewHeaderText =
    headerText ||
    (newTemplate.components || []).find((component) => component.type === "HEADER")
      ?.text ||
    "";

  const variableMappingDisplay = Object.entries(
    newTemplate.variableMap || {}
  ).map(([idx, name]) => (
    <span
      key={idx}
      className="inline-block px-2 py-1 mr-2 text-xs text-gray-500 bg-gray-100 rounded"
    >
      {`{{${idx}}} = ${name}`}
    </span>
  ));

  const syncTemplateStatus = async ({ silent = false } = {}) => {
    setSyncLoaderActive(true);
    try {
      const res = await api.post("/template/template/sync-status");
      if (res?.data?.success) {
        const nextTemplates = res.data.templates || [];
        setTemplates(nextTemplates);

        if (selectedTemplate?._id) {
          const refreshedSelectedTemplate = nextTemplates.find(
            (template) => template._id === selectedTemplate._id
          );
          if (refreshedSelectedTemplate) {
            setSelectedTemplate(refreshedSelectedTemplate);
          }
        }

        if (!silent) {
          toast.success(
            res.data.message ||
              `Synced ${res.data.updated || 0} template${res.data.updated === 1 ? "" : "s"}`
          );
        }
      } else {
        if (!silent) {
          toast.error("Failed to sync status");
        }
      }
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to sync status");
      }
    } finally {
      setSyncLoaderActive(false);
    }
  };

  useEffect(() => {
    syncTemplateStatus({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHeaderTypeChange = (e) => {
    const type = e.target.value;
    setHeaderType(type);
    setNewTemplate((prev) => {
      let others = prev.components.filter((c) => c.type !== "HEADER");
      if (!others.some((c) => c.type === "BODY")) {
        others = [{ type: "BODY", text: "" }, ...others];
      }
      if (type === "NONE") {
        setHeaderText("");
        setHeaderImageUrl("");
        return {
          ...prev,
          components: others,
        };
      } else if (type === "TEXT") {
        setHeaderImageUrl("");
        return {
          ...prev,
          components: [
            { type: "HEADER", format: "TEXT", text: headerText },
            ...others,
          ],
        };
      } else if (type === "IMAGE") {
        setHeaderText("");
        return {
          ...prev,
          components: [
            {
              type: "HEADER",
              format: "IMAGE",
              example: { header_handle: headerImageUrl },
            },
            ...others,
          ],
        };
      }
      return prev;
    });
  };

  const handleHeaderTextChange = (e) => {
    setHeaderText(e.target.value);
    setNewTemplate((prev) => {
      const others = prev.components.filter((c) => c.type !== "HEADER");
      return {
        ...prev,
        components: [
          { type: "HEADER", format: "TEXT", text: e.target.value },
          ...others,
        ],
      };
    });
  };

  const handleHeaderImageUrlChange = (e) => {
    setHeaderImageUrl(e.target.value);
    setHeaderImagePreviewUrl("");
    setNewTemplate((prev) => {
      const others = prev.components.filter((c) => c.type !== "HEADER");
      return {
        ...prev,
        components: [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: e.target.value },
          },
          ...others,
        ],
      };
    });
  };

  const handleFooterTextChange = (e) => {
    setFooterText(e.target.value.slice(0, 60));
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error("Use at most 3 buttons for this template editor.");
      return;
    }
    setButtons((prev) => [...prev, createEmptyButton()]);
  };

  const handleButtonChange = (index, field, value) => {
    setButtons((prev) =>
      prev.map((button, buttonIndex) => {
        if (buttonIndex !== index) return button;

        if (field === "type") {
          return {
            ...createEmptyButton(),
            type: value,
            text: button.text,
          };
        }

        return {
          ...button,
          [field]: field === "text" ? value.slice(0, 25) : value,
        };
      })
    );
  };

  const handleRemoveButton = (index) => {
    setButtons((prev) => prev.filter((_, buttonIndex) => buttonIndex !== index));
  };

  const handleBackToTemplates = () => {
    setIsCreatingNew(false);
    setSelectedTemplate(null);
    resetTemplateEditor();
  };

  const clearTemplateFilters = () => {
    setTemplateSearchTerm("");
    setDebouncedTemplateSearchTerm("");
    setTemplateCategoryFilter("");
    setTemplateStatusFilter("");
    setTemplateLanguageFilter("");
  };

  return (
    <div className="p-4 sm:p-6">
      <div>
        {!isFormOpen && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Message Templates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a template from the list or open the editor to create a new one.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={syncTemplateStatus}
                  disabled={syncLoaderActive}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  title="Sync template status from WhatsApp"
                >
                  <MdSync className="text-lg" /> {syncLoaderActive ? "Syncing..." : "Sync Status"}
                </button>
                <button
                  onClick={handleNewTemplateClick}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <MdAdd className="text-xl" />
                  Create Template
                </button>
              </div>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdGroups className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Selected architects</div>
                    </div>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                      Current audience
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-3xl font-semibold leading-none">{users.length}</div>
                      <div className="mt-2 text-xs font-medium text-blue-100">selected rows</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdCode className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Templates</div>
                    </div>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                      {hasTemplateFilters ? "Filtered results" : "Available templates"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-3xl font-semibold leading-none">
                        {hasTemplateFilters ? filteredTemplates.length : templates.length}
                      </div>
                      <div className="mt-2 text-xs font-medium text-blue-100">
                        {hasTemplateFilters ? "filtered rows" : "total templates"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg bg-blue-600 p-5 text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
                <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/14 text-white">
                        <MdVisibility className="h-5 w-5" />
                      </div>
                      <div className="text-xs uppercase tracking-wide text-blue-100">Next Step</div>
                    </div>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50 backdrop-blur-sm">
                      {!hasSelectedArchitects
                        ? "Architects required"
                        : hasSelectedScheduleTemplate
                          ? "Ready for schedule"
                          : "Template selection pending"}
                    </div>
                  </div>
                  <div className="text-right">
                    {!hasSelectedArchitects ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToArchitects?.()}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Select Architects
                      </button>
                    ) : hasSelectedScheduleTemplate ? (
                      <button
                        type="button"
                        onClick={() => onSelectScheduleTemplate?.(selectedScheduleTemplateId)}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Continue to Schedule
                      </button>
                    ) : (
                      <div className="rounded-lg bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                        <div className="text-sm font-semibold leading-none">Select Template</div>
                        <div className="mt-2 text-xs font-medium text-blue-100">choose one below</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Card className="mb-6">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200/80 p-3">
                <div className="flex min-w-[280px] flex-col gap-1.5">
                  <div className="flex h-auto flex-wrap justify-start gap-1 rounded-md bg-slate-100 p-1">
                    <button
                      type="button"
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        !templateStatusFilter
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                      onClick={() => setTemplateStatusFilter("")}
                    >
                      All ({templateStatusCounts.ALL})
                    </button>
                    {["APPROVED", "PENDING", "REJECTED", "MISSING_ON_META"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`rounded px-3 py-1.5 text-sm font-medium ${
                          templateStatusFilter === status
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        onClick={() => setTemplateStatusFilter(status)}
                      >
                        {status === "MISSING_ON_META"
                          ? `Missing on Meta (${templateStatusCounts[status]})`
                          : `${status.charAt(0) + status.slice(1).toLowerCase()} (${templateStatusCounts[status]})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-[520px] sm:min-w-[360px]">
                  <div className="relative">
                    <FiSearch className="absolute left-2 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-slate-400" />
                    <input
                      value={templateSearchTerm}
                      onChange={(event) => setTemplateSearchTerm(event.target.value)}
                      placeholder="Search name, category, language, status..."
                      className="!h-9 !min-h-9 w-full !pl-8 !pr-8"
                    />
                    {templateSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateSearchTerm("");
                          setDebouncedTemplateSearchTerm("");
                        }}
                        className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Clear search"
                      >
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-44">
                  <Select
                    value={templateCategoryFilter}
                    onValueChange={setTemplateCategoryFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="UTILITY">UTILITY</SelectItem>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-40">
                  <Select
                    value={templateLanguageFilter}
                    onValueChange={setTemplateLanguageFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Languages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Languages</SelectItem>
                      {templateLanguageOptions.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  onClick={clearTemplateFilters}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>

              {hasTemplateFilters && (
                <div className="px-2 pb-2 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {templateSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setTemplateSearchTerm("")}
                        className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        Search: {debouncedTemplateSearchTerm}
                        <FiX className="h-3 w-3" />
                      </button>
                    )}
                    {templateStatusFilter && (
                      <button
                        type="button"
                        onClick={() => setTemplateStatusFilter("")}
                        className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        Status: {templateStatusFilter === "MISSING_ON_META" ? "Missing on Meta" : templateStatusFilter}
                        <FiX className="h-3 w-3" />
                      </button>
                    )}
                    {templateCategoryFilter && (
                      <button
                        type="button"
                        onClick={() => setTemplateCategoryFilter("")}
                        className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        Category: {templateCategoryFilter}
                        <FiX className="h-3 w-3" />
                      </button>
                    )}
                    {templateLanguageFilter && (
                      <button
                        type="button"
                        onClick={() => setTemplateLanguageFilter("")}
                        className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        Language: {templateLanguageFilter}
                        <FiX className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div>
                {templates.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-slate-500">No templates available.</p>
                    <button
                      onClick={handleNewTemplateClick}
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Create Template
                    </button>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-slate-500">No templates match the current filters.</p>
                    <button
                      type="button"
                      onClick={clearTemplateFilters}
                      className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 block space-y-2 p-0.5 sm:hidden">
                      {filteredTemplates.map((template) => {
                        const statusMeta = getTemplateStatusMeta(template?.status);
                        const variableCount = Object.keys(template?.variableMap || {}).length;
                        const isSelected = selectedScheduleTemplateId === template?._id;

                        return (
                          <div
                            key={template?._id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleTemplatePreviewSelect(template?._id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleTemplatePreviewSelect(template?._id);
                              }
                            }}
                            className={`w-full rounded-lg border bg-white p-3 text-left transition-colors hover:bg-slate-50 ${
                              isSelected
                                ? "border-blue-300 ring-1 ring-inset ring-blue-200"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="scheduleTemplate"
                                checked={isSelected}
                                onChange={() => handleTemplatePreviewSelect(template?._id)}
                                className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate text-sm font-medium leading-tight text-slate-950">
                                      {template?.name}
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {template?.category} / {template?.language}
                                    </p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                                    {statusMeta.label}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>{variableCount} variable{variableCount === 1 ? "" : "s"}</span>
                                  <span>
                                    {template?.createdAt
                                      ? new Date(template.createdAt).toLocaleDateString()
                                      : "Template"}
                                  </span>
                                  {isSelected && (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                                      Selected
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden sm:block">
                      <div className="relative overflow-x-auto">
                        <Table wrapperClassName="overflow-visible">
                          <TableHeader sticky>
                            <TableRow>
                              <TableHead className="w-12">Select</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Language</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Variables</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTemplates.map((template) => {
                              const statusMeta = getTemplateStatusMeta(template?.status);
                              const variableCount = Object.keys(template?.variableMap || {}).length;
                              const isSelected = selectedScheduleTemplateId === template?._id;

                              return (
                                <TableRow key={template?._id}>
                                  <TableCell>
                                    <input
                                      type="radio"
                                      name="scheduleTemplate"
                                      checked={isSelected}
                                      onChange={() => handleTemplatePreviewSelect(template?._id)}
                                      className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      onClick={() => handleTemplatePreviewSelect(template?._id)}
                                      className="font-medium text-slate-950 hover:text-blue-700"
                                    >
                                      {template?.name}
                                    </button>
                                  </TableCell>
                                  <TableCell>{template?.category}</TableCell>
                                  <TableCell className="text-slate-500">{template?.language}</TableCell>
                                  <TableCell>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                                      {statusMeta.label}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-slate-500">{variableCount}</TableCell>
                                  <TableCell className="text-slate-500">
                                    {template?.createdAt
                                      ? new Date(template.createdAt).toLocaleDateString()
                                      : "Template"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleTemplateSelect(template?._id)}
                                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => handleDelete(template?._id, e)}
                                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                                        aria-label={`Delete ${template?.name}`}
                                      >
                                        <MdDelete className="text-base" />
                                      </button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {isFormOpen && (
          <div ref={formRef} className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  {isCreatingNew ? "Create New Template" : "Edit Template"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit the template content, variables, and header settings here.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBackToTemplates}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Templates
              </button>
            </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    {...register("name")}
                    value={newTemplate.name}
                    onChange={(e) => handleTemplateNameChange(e.target.value)}
                    placeholder="e.g. renewal_notice"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use lower-case letters and underscores only.
                  </p>
                  {errors.name?.message && (
                    <div className="mt-1 text-xs text-red-600">
                      {errors.name.message}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleTemplateCategoryChange(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTILITY">UTILITY</SelectItem>
                          <SelectItem value="MARKETING">MARKETING</SelectItem>
                          <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.category?.message && (
                    <div className="mt-1 text-xs text-red-600">
                      {errors.category.message}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Language
                  </label>
                  <input
                    type="text"
                    {...register("language")}
                    value={newTemplate.language}
                    onChange={(e) => handleTemplateLanguageChange(e.target.value)}
                    placeholder="e.g. en_US"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.language?.message && (
                    <div className="mt-1 text-xs text-red-600">
                      {errors.language.message}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Header
                  </label>
                  <Select
                    value={headerType}
                    onValueChange={(value) =>
                      handleHeaderTypeChange({ target: { value } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select header" />
                    </SelectTrigger>
                    <SelectContent>
                      {headerTypes.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {headerType === "TEXT" && (
                    <input
                      type="text"
                      value={headerText}
                      onChange={handleHeaderTextChange}
                      placeholder="Enter header text"
                      className="w-full px-4 py-2 mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                  {headerType === "IMAGE" && (
                    <div>
                      <input
                        type="text"
                        value={headerImageUrl}
                        onChange={handleHeaderImageUrlChange}
                        placeholder="Upload an image to generate a Meta header handle"
                        className="w-full px-4 py-2 mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="p-3 mt-2 border border-blue-200 rounded-md bg-blue-50">
                        <h4 className="mb-2 text-sm font-medium text-blue-800">WhatsApp Business API Image Requirements:</h4>
                        <ul className="space-y-1 text-xs text-blue-700">
                          <li>• Supported formats: JPG, PNG only</li>
                          <li>• Maximum file size: 5MB</li>
                          <li>• Recommended dimensions: Up to 1024x1024 pixels</li>
                          <li>• Images will be automatically optimized for WhatsApp</li>
                        </ul>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          // Client-side validation
                          const maxSizeInMB = 5;
                          const fileSizeInMB = file.size / (1024 * 1024);
                          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

                          if (!allowedTypes.includes(file.type)) {
                            toast.error('Please select a valid image file (JPG or PNG only).');
                            e.target.value = ''; // Clear the input
                            return;
                          }

                          if (fileSizeInMB > maxSizeInMB) {
                            toast.error(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds the 5MB limit required by WhatsApp Business API.`);
                            e.target.value = ''; // Clear the input
                            return;
                          }

                          const formData = new FormData();
                          formData.append("file", file);

                          // Show loading state
                          const uploadingToast = toast.loading('Uploading image...', {
                            duration: 30000 // 30 seconds timeout
                          });

                          try {
                            const res = await uploadHeaderImage(formData).unwrap();

                            toast.dismiss(uploadingToast);

                            if (res.success) {
                              const headerHandle =
                                res.header_handle || res.data?.header_handle;
                              const previewUrl =
                                res.preview_url || res.data?.preview_url || "";

                              if (!headerHandle) {
                                toast.error("Upload succeeded but Meta did not return a header handle.");
                                return;
                              }

                              setHeaderImageUrl(headerHandle);
                              setHeaderImagePreviewUrl(previewUrl);
                              handleHeaderImageUrlChange({
                                target: { value: headerHandle },
                              });
                              setHeaderImagePreviewUrl(previewUrl);

                              toast.success(res.message || 'Image uploaded successfully!');
                            } else {
                              toast.error(res.message || 'Upload failed. Please try again.');
                            }
                          } catch (error) {
                            toast.dismiss(uploadingToast);
                            console.error('Upload error:', error);

                            // Handle different error scenarios
                            if (error.response) {
                              const errorMessage = error.response.data?.message || 'Upload failed';
                              toast.error(errorMessage);
                            } else if (error.request) {
                              toast.error('Network error. Please check your connection and try again.');
                            } else {
                              toast.error('An unexpected error occurred. Please try again.');
                            }
                          } finally {
                            // Clear the file input regardless of success/failure
                            e.target.value = '';
                          }
                        }}
                      />
                      {headerImagePreviewUrl && (
                        <img
                          src={headerImagePreviewUrl}
                          alt="Header"
                          className="object-contain mt-2 max-h-32"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Message Content
                  </label>
                  <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
                    {textFormatActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => applyMessageFormat(action)}
                          title={action.label}
                          aria-label={action.label}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-transparent px-2 text-sm font-medium text-slate-700 hover:border-slate-200 hover:bg-white"
                        >
                          {Icon ? <Icon className="text-lg" /> : action.text}
                        </button>
                      );
                    })}
                    <div className="mx-1 h-5 w-px bg-gray-200" />
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        setFilteredSuggestions(
                          suggestions.filter(
                            (s) =>
                              !Object.values(newTemplate.variableMap).includes(s)
                          )
                        );
                        setShowSuggestions(true);
                      }}
                    >
                      + Variable
                    </button>
                  </div>
                  <textarea
                    ref={messageRef}
                    value={
                      newTemplate.components.find((c) => c.type === "BODY")
                        ?.text || ""
                    }
                    onChange={handleContentChange}
                    rows={8}
                    placeholder="Type your message, select text, then apply WhatsApp formatting"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showSuggestions && (
                    <div className="absolute z-10 w-full max-w-xs mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                      {filteredSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50"
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {validationErrors.length > 0 && (
                  <div className="mb-2 text-xs text-red-600">
                    {validationErrors.map((err, idx) => (
                      <div key={idx}>{err}</div>
                    ))}
                  </div>
                )}

                {Object.keys(newTemplate.variableMap || {}).length > 0 && (
                  <div className="mb-2">{variableMappingDisplay}</div>
                )}

                {(() => {
                  const bodyComp = newTemplate.components.find(
                    (c) => c.type === "BODY"
                  );
                  if (!bodyComp) return null;
                  const matches = [
                    ...(bodyComp.text || "").matchAll(/\{\{(\d+)\}\}/g),
                  ];
                  const numbers = Array.from(
                    new Set(matches.map((m) => parseInt(m[1])))
                  ).sort((a, b) => a - b);
                  if (!numbers.length) return null;
                  return (
                    <div className="p-3 mb-4 border border-gray-200 rounded bg-gray-50">
                      <div className="mb-2 font-semibold">
                        Variable Samples (for Meta approval)
                      </div>
                      {numbers.map((idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 text-xs bg-gray-200 rounded">
                            {"{{" + idx + "}}"}
                          </span>
                          <input
                            type="text"
                            value={bodyVariableSamples[idx] || ""}
                            onChange={(e) =>
                              handleBodySampleChange(idx, e.target.value)
                            }
                            placeholder={`Sample for {{${idx}}}`}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded"
                          />
                        </div>
                      ))}
                      <div className="mt-1 text-xs text-gray-500">
                        Include samples of all variables in your message to help
                        Meta review your template. Do not use real customer
                        data.
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Footer
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={handleFooterTextChange}
                    placeholder="Optional footer text"
                    maxLength={60}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Footer text is optional and cannot use variables.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Buttons
                    </label>
                    <button
                      type="button"
                      onClick={handleAddButton}
                      disabled={buttons.length >= 3}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Add Button
                    </button>
                  </div>

                  {buttons.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                      No buttons added.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {buttons.map((button, index) => (
                        <div
                          key={index}
                          className="rounded-md border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-slate-700">
                              Button {index + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveButton(index)}
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="block mb-1 text-xs font-medium text-gray-600">
                                Type
                              </label>
                              <Select
                                value={button.type}
                                onValueChange={(value) =>
                                  handleButtonChange(index, "type", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Button type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {buttonTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block mb-1 text-xs font-medium text-gray-600">
                                Button Text
                              </label>
                              <input
                                type="text"
                                value={button.text}
                                onChange={(e) =>
                                  handleButtonChange(index, "text", e.target.value)
                                }
                                placeholder="Button label"
                                maxLength={25}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          {button.type === "URL" && (
                            <div className="mt-3">
                              <label className="block mb-1 text-xs font-medium text-gray-600">
                                Website URL
                              </label>
                              <input
                                type="url"
                                value={button.url}
                                onChange={(e) =>
                                  handleButtonChange(index, "url", e.target.value)
                                }
                                placeholder="https://example.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          )}

                          {button.type === "PHONE_NUMBER" && (
                            <div className="mt-3">
                              <label className="block mb-1 text-xs font-medium text-gray-600">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={button.phone_number}
                                onChange={(e) =>
                                  handleButtonChange(
                                    index,
                                    "phone_number",
                                    e.target.value
                                  )
                                }
                                placeholder="+919876543210"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <button
                    onClick={handleBackToTemplates}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    Back to Templates
                  </button>
                  <div className="flex gap-4">
                    {isCreatingNew ? (
                      <button
                        onClick={handleTemplateSave}
                        disabled={
                          addLoaderActive || validationErrors.length > 0
                        }
                        className="flex items-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-70"
                      >
                        {addLoaderActive ? (
                          <BeatLoader color="#ffffff" size={8} />
                        ) : (
                          "Save Template"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleUpdateTemplate(selectedTemplate?._id)
                        }
                        disabled={
                          updateLoaderActive || validationErrors.length > 0
                        }
                        className="flex items-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-70"
                      >
                        {updateLoaderActive ? (
                          <BeatLoader color="#ffffff" size={8} />
                        ) : (
                          "Update Template"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 px-5 py-5 lg:border-t-0 lg:border-l">
                <div className="sticky top-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Live Preview
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        getTemplateStatusMeta(selectedTemplate?.status || "Draft").className
                      }`}
                    >
                      {getTemplateStatusMeta(selectedTemplate?.status || "Draft").label}
                    </span>
                  </div>
                  <TemplateMobilePreview
                    statusLabel={getTemplateStatusMeta(selectedTemplate?.status || "Draft").label}
                    statusClassName={getTemplateStatusMeta(selectedTemplate?.status || "Draft").className}
                    headerType={headerType}
                    headerText={previewHeaderText}
                    headerImageUrl={previewHeaderImage}
                    bodyText={previewText}
                    footerText={footerText}
                    buttons={buttons}
                    variableCount={Object.keys(newTemplate.variableMap || {}).length}
                    previewText={previewText}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageTemplates;
