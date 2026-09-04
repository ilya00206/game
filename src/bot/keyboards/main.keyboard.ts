import { InlineKeyboard } from 'grammy';
import { CB, cb } from '../callback-data';

export function mainMenuKeyboard(isAdmin: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('📚 Учиться', cb(CB.learn, 'start'))
    .text('🎯 Задания', cb(CB.quests, 'list'))
    .row()
    .text('🎁 Бонус', cb(CB.bonus, 'open'))
    .text('📊 Прогресс', cb(CB.progress, 'open'))
    .row()
    .text('🛍 Магазин', cb(CB.shop, 'list'))
    .text('🏆 Достижения', cb(CB.achievements, 'list'))
    .row()
    .text('👤 Профиль', cb(CB.profile, 'open'))
    .text('⚙️ Настройки', cb(CB.settings, 'open'));

  if (isAdmin) {
    keyboard.row().text('⚙️ Admin', cb(CB.admin, 'menu'));
  }

  return keyboard;
}

export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⬅️ В меню', cb(CB.menu, 'main'));
}

export function backButton(keyboard: InlineKeyboard): InlineKeyboard {
  return keyboard.row().text('⬅️ В меню', cb(CB.menu, 'main'));
}
