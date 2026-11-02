from functools import wraps
from typing import Any, Callable


def repeat(times: int = 1) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            result = None

            for _ in range(times):
                result = func(*args, **kwargs)

            return result

        return wrapper

    return decorator


@repeat(times=3)
def greet(name: str) -> str:
    return f"Hello, {name}"


def log_call(prefix: str = "LOG") -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            print(f"{prefix}: calling {func.__name__}")
            return func(*args, **kwargs)

        return wrapper

    return decorator


@log_call(prefix="SERVICE")
def calculate_total(price: float, quantity: int) -> float:
    return price * quantity