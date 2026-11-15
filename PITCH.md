# SUBXVoice — keep working, say the rest

**A voice helper for Windows that understands Hindi, English, or both in one sentence, and acts on what it hears.**
Built by Bhavesh Parmar and Aarnav Mathakiya on Gnani AI's **Prisma** speech model, for the Great Indian AI Internship Challenge.

**Try it:** [subxvoice.vercel.app](https://subxvoice.vercel.app) (free, Windows 10 and 11) · **Code:** [github.com/voldemort9999/subxvoice-app](https://github.com/voldemort9999/subxvoice-app)

## The problem

A working day keeps breaking into small jobs. Your boss adds two tasks in the middle of a report, someone needs your resume, a call starts before your earbuds are connected, and a reply is owed on WhatsApp. None of it is hard, but each job means stopping, clicking through windows and coming back, and by then the thought you were holding is gone.

We speak much faster than we type, yet PC voice tools mostly type what you say rather than act on it. They also expect one language at a time, while much of India speaks the way it thinks. *"Kal meeting hai, slides ready rakhna"* is one sentence. Typing is also a barrier in itself for many people, such as parents writing to family or anyone who never learned to type fast.

## The solution: two keys, no window

SUBXVoice sits in the tray. You hold a key, speak, and let go, without leaving the app you're in.

- **Follow My Words** (hold Ctrl + Alt) does what you ask on the PC, in front of you.
- **Dictation** (hold Ctrl + Win) types what you say at the cursor, in any app you can paste into. Ask for an email or a message and it writes the finished thing in the tone you chose.

## A day with it

| Moment | You say | What happens |
|---|---|---|
| Boss adds work mid-report | "Notepad kholo aur aaj ke tasks likho: client ko call karna, report bhejna" | Notepad opens and the list is typed: one sentence, two planned steps |
| HR asks for your resume | "Pictures wale folder mein mera resume dhoondo" | Pictures opens with `My Resume.pdf` selected |
| A call is about to start | "OnePlus Buds connect karo" | The paired earbuds connect |
| Feeling unwell | "boss ko email likho ki kal mujhe chhutti chahiye, tabiyat theek nahi hai" | A full leave email in English, with subject, body and your name |
| Running late | "WhatsApp pe Aryan ko likho aaj main nahi aa paunga" | The chat opens and the message is typed. **It is never sent for you** |
| Message home | "mummy ko message bhejo ki main aaj khana bahar kha lunga" | "Mummy, aaj main bahar hi khana kha lunga." It stays in the language you spoke |
| A student's study break | "YouTube pe Kesariya chalao" · "brightness 60% kar do" | The song plays and the screen is set to 60% |
| Using an AI tool | "ek React pricing table banao, teen tier ka, middle wala highlighted" | The prompt is typed into the ChatGPT box |
| A refund form | "mera order kal aaya tha lekin box mein charger nahi tha" | The complaint is written into the form field |

## Built for Indian languages

- **Code-mixed by default.** Switch between Hindi and English mid-sentence on either key and it keeps up. Hindi is typed in Roman letters, the way people type in chat, or in Devanagari if you prefer. **It never translates you.**
- **Ten languages in the speech layer.** The Prisma integration accepts Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu and Indian English.
- **One language fixed, for now, on purpose.** We tested Prisma's automatic language detection, and on a Hinglish clip it guessed Telugu. So the app fixes the language to Hindi-English, which handles the mix correctly. The next release adds a picker, so a Tamil, Bengali or Marathi speaker chooses their own language, and each language is tested before it ships.
- **Holds up with noise around.** It's tested with real background noise, and a personal dictionary teaches it names it keeps mishearing.

## How it works

1. **Hearing (Gnani Prisma).** The mic opens on key-down and streams to Prisma while you talk, so letting go only waits for your last words.
2. **Planning.** Gemini 2.5 Flash turns the sentence into ordered steps before anything runs. A decisions model (Jev) picks the action or on-screen element for each step. If a step can't be done, the app stops and says which one.
3. **Doing.** Settings, apps, files and Bluetooth go through Windows directly. Inside apps such as WhatsApp or YouTube, it reads on-screen names as text through UI Automation, and it takes no screenshots.
4. **Writing.** gpt-oss-120b writes the Roman script and drafts emails and messages. The text is pasted where your cursor was.

## Safe by design

- It never sends a message on its own.
- The mic is on only while a key is held.
- Transcripts and recordings stay on your computer.
- It needs no admin rights, and no API keys sit on your machine.

## Where it stands

Version **0.4.2** is live, with a public installer and automatic updates, and the free beta includes two hours of listening a day. Next on the list:

- the language picker;
- the macOS build, which already runs;
- support for apps that draw their own screen, such as games.
