'use client';
import Link from 'next/link';
import {
  Feather,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  Check,
  Settings2,
  Blocks,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
export type PublisherMode = 'write' | 'plan' | 'analyze';
export const modes = [
  { id: 'write', label: 'Escribir', Icon: Feather },
  { id: 'plan', label: 'Planificar', Icon: CalendarDays },
  { id: 'analyze', label: 'Analizar', Icon: ChartNoAxesColumn },
] as const;
export function ModeSwitcher({
  mode,
  onChange,
  canNavigate,
}: {
  mode: PublisherMode;
  onChange: (mode: PublisherMode) => void;
  canNavigate: () => boolean;
}) {
  const current = modes.find((item) => item.id === mode)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="mode-trigger"
        aria-label={'Modo: ' + current.label}
      >
        <current.Icon size={22} aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mode-menu">
        {modes.map(({ id, label, Icon }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => onChange(id)}
            className="mode-menu-item"
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            {mode === id && (
              <Check className="mode-check" aria-label="Modo activo" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="mode-menu-item"
          render={
            <Link
              href="/settings"
              onClick={(event) => {
                if (!canNavigate()) event.preventDefault();
              }}
            />
          }
        >
          <Settings2 aria-hidden="true" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuItem
          className="mode-menu-item"
          render={
            <Link
              href="/sources"
              onClick={(event) => {
                if (!canNavigate()) event.preventDefault();
              }}
            />
          }
        >
          <Blocks aria-hidden="true" />
          Canales e integraciones
        </DropdownMenuItem>
        <DropdownMenuItem
          className="mode-menu-item"
          render={
            <Link
              href="/settings#agents"
              onClick={(event) => {
                if (!canNavigate()) event.preventDefault();
              }}
            />
          }
        >
          <Blocks aria-hidden="true" />
          Agentes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
