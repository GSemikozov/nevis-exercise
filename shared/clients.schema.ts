import * as z from 'zod/mini';

/** Where the client tree is served. Versioned, so the contract can change without
 * breaking existing clients. */
export const CLIENTS_ENDPOINT = '/api/v1/clients';

/** The same data with the demo switches (?delay, ?fail), on a path of its own. */
export const DEMO_CLIENTS_ENDPOINT = '/api/v1/demo/clients';

/*
 * Contract for `GET /api/v1/clients`. The server validates its data against it at startup,
 * and the client validates every response before it reaches the UI.
 *
 * The tree is not uniform: each level names its children differently and any level
 * may have none (Branch 2 has no employees; only one employee has channels).
 */

const monthlyValues = z.array(z.int().check(z.nonnegative()));

const nodeShape = {
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  values: monthlyValues,
};

export const channelSchema = z.object(nodeShape);
export const employeeSchema = z.object({
  ...nodeShape,
  channels: z.optional(z.array(channelSchema)),
});
export const branchSchema = z.object({
  ...nodeShape,
  employees: z.optional(z.array(employeeSchema)),
});
export const companySchema = z.object({
  ...nodeShape,
  branches: z.optional(z.array(branchSchema)),
});

export type Channel = z.infer<typeof channelSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Company = z.infer<typeof companySchema>;

type AnyNode = Company | Branch | Employee | Channel;

export function childrenOf(node: AnyNode): AnyNode[] {
  if ('branches' in node) return node.branches ?? [];
  if ('employees' in node) return node.employees ?? [];
  if ('channels' in node) return node.channels ?? [];
  return [];
}

function* walk(node: AnyNode): Generator<AnyNode> {
  yield node;
  for (const child of childrenOf(node)) yield* walk(child);
}

function hasUniformPeriod(company: Company): boolean {
  const length = company.values.length;
  return [...walk(company)].every((node) => node.values.length === length);
}

function hasUniqueIds(company: Company): boolean {
  const ids = [...walk(company)].map((node) => node.id);
  return new Set(ids).size === ids.length;
}

export const clientsResponseSchema = z.object({
  data: companySchema.check(
    z.refine(hasUniformPeriod, 'Every node must have the same number of monthly values'),
    z.refine(hasUniqueIds, 'Node ids must be unique')
  ),
  meta: z.object({
    /** Month of `values[0]` as `YYYY-MM`; every following index is one month later. */
    periodStart: z.string().check(z.regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
  }),
});

export type ClientsResponse = z.infer<typeof clientsResponseSchema>;
