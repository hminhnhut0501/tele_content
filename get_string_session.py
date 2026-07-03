from telethon import TelegramClient
from telethon.sessions import StringSession


def main():
    api_id = int(input("TG_API_ID: ").strip())
    api_hash = input("TG_API_HASH: ").strip()
    phone = input("Phone number (vd: +8490...): ").strip()

    with TelegramClient(StringSession(), api_id, api_hash) as client:
        client.start(phone=phone)
        print("\nTG_STRING_SESSION:")
        print(client.session.save())


if __name__ == "__main__":
    main()
