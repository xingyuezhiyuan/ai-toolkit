import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';
import { defaultTrainFolder, defaultDatasetsFolder, defaultModelsFolder } from '@/paths';
import { flushCache } from '@/server/settings';

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const settingsObject = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    // if TRAINING_FOLDER is not set, use default
    if (!settingsObject.TRAINING_FOLDER || settingsObject.TRAINING_FOLDER === '') {
      settingsObject.TRAINING_FOLDER = defaultTrainFolder;
    }
    // if DATASETS_FOLDER is not set, use default
    if (!settingsObject.DATASETS_FOLDER || settingsObject.DATASETS_FOLDER === '') {
      settingsObject.DATASETS_FOLDER = defaultDatasetsFolder;
    }
    // MODELS_PATH from the env file always takes precedence over the setting
    if (process.env.MODELS_PATH && process.env.MODELS_PATH.trim() !== '') {
      settingsObject.MODELS_PATH = process.env.MODELS_PATH;
    } else if (!settingsObject.MODELS_PATH || settingsObject.MODELS_PATH === '') {
      // if MODELS_PATH is not set, use default
      settingsObject.MODELS_PATH = defaultModelsFolder;
    }
    return NextResponse.json(settingsObject);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

const ALLOWED_KEYS = ['HF_TOKEN', 'TRAINING_FOLDER', 'DATASETS_FOLDER', 'MODELS_PATH', 'LANGUAGE'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Partial-safe: only upsert string values actually present in this request.
    // (Language switch posts {LANGUAGE} alone and must not wipe HF_TOKEN.)
    const ops = ALLOWED_KEYS.filter(k => typeof body?.[k] === 'string').map(k =>
      prisma.settings.upsert({
        where: { key: k },
        update: { value: body[k] },
        create: { key: k, value: body[k] },
      })
    );
    if (ops.length === 0) {
      return NextResponse.json({ error: 'No valid settings keys in body' }, { status: 400 });
    }
    await Promise.all(ops);

    flushCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
