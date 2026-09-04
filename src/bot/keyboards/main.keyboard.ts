import { InlineKeyboard } from 'grammy';
import { CB, cb } from '../callback-data';

export function mainMenuKeyboard(isAdmin: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('📚 Учиться', cb(CB.learn, 'start'))
    .row()
    .text('➕ Добавить слово', cb(CB.learn, 'add'))
    .row()
    .text(' Профиль', cb(CB.profile, 'open'))
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
