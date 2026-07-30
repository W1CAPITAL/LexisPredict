/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border/20 rounded-none bg-background/5 animate-in fade-in duration-500",
      className
    )}>
      <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-6 text-muted-foreground/40 border-2 border-border/10">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">{title}</h3>
      <p className="text-[11px] font-bold uppercase text-muted-foreground max-w-[280px] leading-relaxed mb-6 tracking-widest">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="bg-black text-white border-2 border-black hover:bg-white hover:text-black font-black h-10 px-8 uppercase text-[10px] rounded-none transition-all"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
