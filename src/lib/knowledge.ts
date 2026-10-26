import { z } from 'zod'

export const knowledgeNoteSchema = z.object({
  id: z.string().min(1).max(100),
  profileId: z.string().min(1).max(100),
  entity: z.string().min(1).max(500),
  field: z.string().min(1).max(500).optional(),
  kind: z.enum([
    'description',
    'status-meaning',
    'workflow',
    'agent-constraint',
  ]),
  status: z.enum(['draft', 'confirmed']),
  text: z.string().trim().min(1).max(4000),
  origin: z.literal('developer-authored'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type KnowledgeNote = z.infer<typeof knowledgeNoteSchema>
