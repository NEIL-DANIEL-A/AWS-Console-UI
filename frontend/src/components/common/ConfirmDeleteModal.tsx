import React from "react";
import Modal from "@cloudscape-design/components/modal";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";

interface ConfirmDeleteModalProps {
  visible: boolean;
  resourceType: "bucket" | "object";
  resourceName: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmDeleteModal({
  visible,
  resourceType,
  resourceName,
  onConfirm,
  onDismiss,
}: ConfirmDeleteModalProps) {
  const [confirmText, setConfirmText] = React.useState("");

  const canDelete =
    confirmText === resourceName ||
    (resourceType === "object" && confirmText.toLowerCase() === "delete");

  const handleDismiss = () => {
    onDismiss();
    setConfirmText("");
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      header={`Delete ${resourceType} "${resourceName}"?`}
      size="medium"
    >
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <p>
          This action cannot be undone.{" "}
          {resourceType === "bucket"
            ? `Type the bucket name "${resourceName}" to confirm.`
            : 'Type "delete" to confirm.'}
        </p>
        <FormField label="Confirmation text">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.detail.value)}
            placeholder={
              resourceType === "bucket" ? resourceName : "delete"
            }
          />
        </FormField>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button
            variant="normal"
            onClick={() => {
              onDismiss();
              setConfirmText("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onConfirm();
              setConfirmText("");
            }}
            disabled={!canDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
