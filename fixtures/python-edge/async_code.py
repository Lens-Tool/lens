import asyncio
from typing import Any


async def fetch_user(user_id: int) -> dict[str, Any]:
    await asyncio.sleep(0.1)

    return {
        "id": user_id,
        "name": f"User {user_id}",
        "active": True,
    }


async def fetch_multiple_users(user_ids: list[int]) -> list[dict[str, Any]]:
    tasks = [fetch_user(user_id) for user_id in user_ids]
    return await asyncio.gather(*tasks)


async def process_user(user_id: int) -> str:
    user = await fetch_user(user_id)

    if user["active"]:
        return f"Processed {user['name']}"

    return "User is inactive"


async def main() -> None:
    users = await fetch_multiple_users([1, 2, 3])

    for user in users:
        print(user)

    result = await process_user(1)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())