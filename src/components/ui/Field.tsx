"use client";

import { useId } from "react";
import styled, { css } from "styled-components";

// =============================================================================
// Minimal, themed form primitives. The site had no inputs before the volunteer
// signup, so these set the convention — keep them consistent with Button.tsx.
// =============================================================================

const controlBase = css<{ $invalid?: boolean }>`
  width: 100%;
  font-family: ${({ theme }) => theme.font.body};
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.bg};
  padding: 0.85rem 1rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1.5px solid
    ${({ theme, $invalid }) =>
      $invalid ? theme.colors.attention : theme.colors.borderStrong};
  transition:
    border-color 0.2s ${({ theme }) => theme.ease.out},
    box-shadow 0.2s ${({ theme }) => theme.ease.out};
  &::placeholder {
    color: ${({ theme }) => theme.colors.inkMuted};
  }
  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => theme.colors.trustBlue};
    box-shadow: 0 0 0 3px rgba(16, 61, 122, 0.12);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  ${controlBase}
`;

export const Textarea = styled.textarea<{ $invalid?: boolean }>`
  ${controlBase}
  min-height: 96px;
  resize: vertical;
`;

const FieldWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const Label = styled.label`
  font-size: 0.85rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: ${({ theme }) => theme.colors.inkSoft};
  span {
    color: ${({ theme }) => theme.colors.sunriseOrange};
  }
`;

const ErrorText = styled.span`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.attention};
`;

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean }) => React.ReactNode;
};

// Render-prop Field: wires a generated id + label + error to any control.
export function Field({ label, required, error, children }: FieldProps) {
  const id = useId();
  return (
    <FieldWrap>
      <Label htmlFor={id}>
        {label} {required && <span aria-hidden>*</span>}
      </Label>
      {children({ id, "aria-invalid": Boolean(error) })}
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </FieldWrap>
  );
}

const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.inkSoft};
  input {
    flex: none;
    width: 20px;
    height: 20px;
    margin-top: 2px;
    accent-color: ${({ theme }) => theme.colors.foundationGreen};
    cursor: pointer;
  }
`;

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked">;

export function Checkbox({ checked, onChange, children, ...rest }: CheckboxProps) {
  return (
    <CheckRow>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span>{children}</span>
    </CheckRow>
  );
}
