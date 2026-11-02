from typing import Any, Optional


def create_user(
    username: str,
    email: str,
    age: int,
    is_active: bool,
    role: str = "viewer",
    department: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "username": username,
        "email": email,
        "age": age,
        "is_active": is_active,
        "role": role,
        "department": department,
    }


def calculate_order_total(
    price: float,
    quantity: int,
    discount: float = 0.0,
    tax_rate: float = 0.14,
    shipping_cost: float = 0.0,
) -> float:
    subtotal: float = price * quantity
    discounted_total: float = subtotal - (subtotal * discount)
    return discounted_total + (discounted_total * tax_rate) + shipping_cost


def process_records(
    records: list[dict[str, Any]],
    required_fields: list[str],
    default_values: Optional[dict[str, Any]] = None,
    strict_mode: bool = True,
) -> list[dict[str, Any]]:
    processed: list[dict[str, Any]] = []

    for record in records:
        if strict_mode and not all(field in record for field in required_fields):
            continue

        updated_record = dict(default_values or {})
        updated_record.update(record)
        processed.append(updated_record)

    return processed


def generate_report(
    title: str,
    data: list[dict[str, Any]],
    include_header: bool = True,
    include_summary: bool = True,
    output_format: str = "text",
) -> str:
    lines: list[str] = []

    if include_header:
        lines.append(title)

    lines.extend(str(item) for item in data)

    if include_summary:
        lines.append(f"Total records: {len(data)}")

    return "\n".join(lines)