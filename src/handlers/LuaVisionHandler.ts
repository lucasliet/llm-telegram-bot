import LuaVisionService from '@/service/LuaVisionService.ts';
import { createVisionHandler } from './HandlerUtils.ts';
import { luaModels } from '@/config/models.ts';

const modelMap = {
	'lua': luaModels.supreme,
};

/**
 * Handles requests for LUA Chat (chat.8th.vision) models with text and image support.
 */
export const handleLuaVision = createVisionHandler({
	modelMap,
	defaultCommand: 'lua',
	createService: (model) => new LuaVisionService(model),
});
