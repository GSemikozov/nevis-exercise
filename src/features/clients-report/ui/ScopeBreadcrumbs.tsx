import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { ReportNode } from '../model/report';

interface ScopeBreadcrumbsProps {
  /** From the root down to the current scope. */
  path: readonly ReportNode[];
  onSelect: (id: string) => void;
}

export function ScopeBreadcrumbs({ path, onSelect }: ScopeBreadcrumbsProps) {
  const lastIndex = path.length - 1;
  return (
    <Breadcrumb aria-label="Chart scope">
      <BreadcrumbList>
        {path.map((node, index) =>
          index === lastIndex ? (
            <BreadcrumbItem key={node.id}>
              <BreadcrumbCurrent>{node.name}</BreadcrumbCurrent>
            </BreadcrumbItem>
          ) : (
            <Fragment key={node.id}>
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => onSelect(node.id)}>{node.name}</BreadcrumbButton>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          )
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
