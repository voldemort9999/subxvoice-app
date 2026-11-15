# SUBXVoice — say it, and keep working

**A voice helper for Windows that understands Hindi, English and both in one sentence, and acts on what it hears.**
Built on Gnani AI's **Prisma** speech model for the Great Indian AI Internship Challenge by Bhavesh Parmar and Aarnav Mathakiya.

**Try it:** [subxvoice.vercel.app](https://subxvoice.vercel.app) (free, Windows 10 and 11) · **Code:** [github.com/voldemort9999/subxvoice-app](https://github.com/voldemort9999/subxvoice-app)

## The problem

A working day breaks into small jobs. Your boss adds two tasks in the middle of a report, someone needs your resume, a call starts before your earbuds are connected, a reply is owed on WhatsApp. None of it is hard, but each one means stopping, clicking through windows and coming back, and by then the thought you were holding is gone.

Voice could take those jobs. But PC voice tools mostly type what you say rather than act on it, and they expect one language at a time. Many of us speak the way we think: *"kal meeting hai, slides ready rakhna"* is a single sentence.

## The solution

SUBXVoice sits in the tray and waits for one of two keys. There's no window to open first.

**Follow My Words** (hold Ctrl + Alt): say what you need, and it gets done in front of you.

| You say | It does |
|---|---|
| "Notepad kholo aur aaj ke tasks likho: client ko call karna, report bhejna" | Opens Notepad and types the list: one sentence, two planned steps |
| "Pictures wale folder mein mera resume dhoondo" | Opens Pictures with `My Resume.pdf` selected |
| "WhatsApp pe Aryan ko likho aaj main nahi aa paunga" | Finds the chat and types the message, then stops. **Sending is always yours** |
| "OnePlus Buds connect karo" · "brightness 60% kar do" · "YouTube pe Kesariya chalao" | Connects the earbuds, sets the screen, plays the first result |

**Dictation** (hold Ctrl + Win): speak, let go, and your words are typed at the cursor in any app you can paste into, such as Gmail, Word, a form or a ChatGPT box. Hindi comes out in Roman letters ("main theek hoon") or Devanagari, and it is never translated. Ask for an email in one line, and you get the full email in the tone you chose.

## How it works

1. **Hearing, by Gnani Prisma.** The mic opens on key-down and streams to Prisma while you talk, so letting go only waits for the last words. Prisma serves both keys and keeps up with mid-sentence switches.
2. **Planning.** Gemini 2.5 Flash turns the sentence into ordered steps before anything runs, and a decisions model (Jev) picks the action or on-screen element for each step. If a step can't be done, the app stops and says which one.
3. **Doing.** Windows settings, apps, files and Bluetooth are handled through Windows directly. Inside apps it reads the on-screen names (chats, video titles) as text through UI Automation, and takes no screenshots.
4. **Writing.** A personal dictionary fixes names that keep being misheard, and gpt-oss-120b writes the Roman script, emails and messages.

## Why it matters

- **It keeps people in their work.** One sentence replaces a detour through windows and settings.
- **It speaks the way India speaks.** Hindi and English mixed is the normal case on both keys.
- **It lowers the bar to typing.** Anyone who types slowly can still write an email, fill a form or prompt an AI tool.
- **It is safe by design.**
  - It never sends a message on its own.
  - The mic is on only while a key is held.
  - Transcripts stay on the computer.
  - It needs no admin rights and keeps no API keys on the machine.

## Where it stands

**Shipped:** version 0.4.2 is live, with a public installer and automatic updates. The free beta gives two hours of listening a day.

**Next:**
- a language picker, so more of the Indian languages Prisma supports can be used (today the app is set to Hindi and English);
- the macOS build, which is already running;
- support for apps that draw their own screen, such as games.
