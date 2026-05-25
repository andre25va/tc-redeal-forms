import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('compliance_rules')
      .select('mls_board, state, form_type, rule_code, rule_name, description, severity, check_type, config, is_active')
      .not('mls_board', 'is', null)
      .order('form_type')
      .order('rule_code');

    if (error) throw error;

    // Group rows into MlsBoard[] shape
    const boardMap = new Map<string, {
      id: string; name: string; fullName: string; region: string; state: string;
      formsMap: Map<string, {
        id: string; formName: string; shortName: string; version: string; pages: number;
        requiredSignatures: number; requiredInitials: number; parties: string[];
        pdfUrl?: string; conditionalTriggers: Array<{
          id: string; fieldLabel: string; condition: string;
          requiresFormId: string; requiresFormName: string; note: string;
          enabled: boolean; parties?: string[];
        }>;
      }>;
    }>();

    for (const row of (data ?? [])) {
      const cfg = (row.config ?? {}) as Record<string, unknown>;
      const boardId = (cfg.board_id as string) ?? row.mls_board;
      const boardName = (cfg.board_name as string) ?? row.mls_board;
      const boardFullName = (cfg.board_full_name as string) ?? row.mls_board;
      const boardRegion = (cfg.board_region as string) ?? '';

      if (!boardMap.has(boardId)) {
        boardMap.set(boardId, {
          id: boardId,
          name: boardName,
          fullName: boardFullName,
          region: boardRegion,
          state: row.state ?? '',
          formsMap: new Map(),
        });
      }

      const board = boardMap.get(boardId)!;
      const formId = row.form_type;

      if (row.check_type === 'custom' && row.rule_code === 'form_meta') {
        // Form metadata row
        if (!board.formsMap.has(formId)) {
          board.formsMap.set(formId, {
            id: formId,
            formName: (cfg.formName as string) ?? row.rule_name,
            shortName: (cfg.shortName as string) ?? row.rule_name,
            version: (cfg.version as string) ?? row.description ?? '',
            pages: (cfg.pages as number) ?? 0,
            requiredSignatures: (cfg.requiredSignatures as number) ?? 0,
            requiredInitials: (cfg.requiredInitials as number) ?? 0,
            parties: (cfg.parties as string[]) ?? [],
            pdfUrl: (cfg.pdfUrl as string) ?? undefined,
            conditionalTriggers: [],
          });
        }
      } else if (row.check_type === 'addendum_required') {
        // Ensure form exists (in case form_meta row wasn't encountered yet)
        if (!board.formsMap.has(formId)) {
          board.formsMap.set(formId, {
            id: formId,
            formName: formId,
            shortName: formId,
            version: '',
            pages: 0,
            requiredSignatures: 0,
            requiredInitials: 0,
            parties: [],
            conditionalTriggers: [],
          });
        }
        const form = board.formsMap.get(formId)!;
        form.conditionalTriggers.push({
          id: row.rule_code,
          fieldLabel: row.rule_name,
          condition: (cfg.condition as string) ?? row.description ?? '',
          requiresFormId: (cfg.requiresFormId as string) ?? '',
          requiresFormName: (cfg.requiresFormName as string) ?? '',
          note: (cfg.note as string) ?? '',
          enabled: row.is_active ?? true,
          parties: (cfg.parties as string[]) ?? undefined,
        });
      }
    }

    // Convert maps to arrays
    const library = Array.from(boardMap.values()).map(b => ({
      id: b.id,
      name: b.name,
      fullName: b.fullName,
      region: b.region,
      state: b.state,
      forms: Array.from(b.formsMap.values()),
    }));

    return NextResponse.json({ library });
  } catch (err) {
    console.error('[library] Error:', err);
    return NextResponse.json({ error: 'Failed to load library' }, { status: 500 });
  }
}
