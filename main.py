import logging
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# បើក logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ត្រូវដាក់ Token ពី @BotFather
TOKEN = "8684494721:AAH4l29MM5FjMtC-4ZJ5Q7nUGOhuFzZr9iY"


# ពាក្យបញ្ជា /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"សួស្តី {update.effective_user.first_name}! 👋\n"
        "ខ្ញុំជា Bot របស់អ្នក។\n"
        "សូមវាយ /help ដើម្បីមើលពាក្យបញ្ជា។"
    )


# ពាក្យបញ្ជា /help
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📋 ពាក្យបញ្ជាដែលមាន:\n"
        "/start - ចាប់ផ្តើម\n"
        "/help - ជំនួយ\n"
        "/echo <អត្ថបទ> - ឆ្លើយតបអត្ថបទ\n"
        "/time - ម៉ោងបច្ចុប្បន្ន"
    )


# ពាក្យបញ្ជា /echo
async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = " ".join(context.args)
    if text:
        await update.message.reply_text(f"🔁 {text}")
    else:
        await update.message.reply_text("សូមវាយ: /echo <អត្ថបទ>")


# ពាក្យបញ្ជា /time
async def time_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await update.message.reply_text(f"🕐 ម៉ោង: {now}")


# ឆ្លើយតបសារធម្មតា
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    await update.message.reply_text(f"អ្នកបានផ្ញើ: {text}")


def main():
    # បង្កើត Application
    app = Application.builder().token(TOKEN).build()

    # បន្ថែម handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("echo", echo))
    app.add_handler(CommandHandler("time", time_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # ចាប់ផ្តើម bot
    print("🤖 Bot កំពុងដំណើរការ...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
