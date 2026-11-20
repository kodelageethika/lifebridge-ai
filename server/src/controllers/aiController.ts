import type { NextFunction, Request, Response } from 'express';
import { ok } from '../middleware/errorHandler.ts';
import {
  askGeneralAssistant,
  generateClinicalSummary,
  generateFairnessInsights,
  generateMatchingExplanation,
  generateRecipientSummary,
} from '../services/aiService.ts';

export async function handleAiRecipientSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateRecipientSummary(req.body, req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleAiMatchingExplanation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateMatchingExplanation(req.body, req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleAiClinicalSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateClinicalSummary(req.body, req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleAiFairnessInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateFairnessInsights(req.body, req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function handleAiGeneralAssistant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await askGeneralAssistant(req.body, req.user!);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
