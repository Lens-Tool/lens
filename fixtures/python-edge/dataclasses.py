from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Address:
    street: str
    city: str
    postal_code: Optional[str] = None


@dataclass
class Employee:
    employee_id: int
    name: str
    department: str
    salary: float
    address: Optional[Address] = None
    skills: list[str] = field(default_factory=list)
    active: bool = True

    def display_name(self) -> str:
        return f"{self.name} ({self.employee_id})"

    def add_skill(self, skill: str) -> None:
        if skill not in self.skills:
            self.skills.append(skill)


@dataclass(frozen=True)
class Product:
    product_id: str
    name: str
    price: float


@dataclass
class Team:
    name: str
    members: list[Employee] = field(default_factory=list)

    def add_member(self, employee: Employee) -> None:
        self.members.append(employee)

    def member_count(self) -> int:
        return len(self.members)