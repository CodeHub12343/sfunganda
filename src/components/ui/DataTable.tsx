"use client";

import styled from "styled-components";
import React from "react";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
};

const Wrap = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
`;

const Th = styled.th<{ $align?: "left" | "right" | "center" }>`
  padding: 0.8rem 1rem;
  text-align: ${({ $align }) => $align ?? "left"};
  color: ${({ theme }) => theme.colors.inkMuted};
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.72rem;
  background: ${({ theme }) => theme.colors.bgSoft};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Td = styled.td<{ $align?: "left" | "right" | "center" }>`
  padding: 0.85rem 1rem;
  text-align: ${({ $align }) => $align ?? "left"};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.ink};
  vertical-align: middle;
`;

const EmptyRow = styled.tr`
  td {
    padding: 2rem 1rem;
    text-align: center;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: React.ReactNode;
  caption?: string;
};

export function DataTable<T>({ columns, rows, getRowKey, empty, caption }: Props<T>) {
  return (
    <Wrap>
      <Table>
        {caption ? <caption style={{ textAlign: "left", padding: "0.5rem 1rem", color: "#6b7280" }}>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c.key} $align={c.align} style={c.width ? { width: c.width } : undefined} scope="col">
                {c.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow>
              <td colSpan={columns.length}>{empty ?? "No rows yet."}</td>
            </EmptyRow>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((c) => (
                  <Td key={c.key} $align={c.align}>
                    {c.render(row)}
                  </Td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Wrap>
  );
}
