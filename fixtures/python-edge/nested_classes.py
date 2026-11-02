class University:
    def __init__(self, name: str):
        self.name = name
        self.students = []

    class Department:
        def __init__(self, name: str, code: str):
            self.name = name
            self.code = code

        def get_info(self) -> str:
            return f"{self.name} ({self.code})"

    class Student:
        def __init__(self, name: str, student_id: int):
            self.name = name
            self.student_id = student_id

        class Contact:
            def __init__(self, email: str, phone: str):
                self.email = email
                self.phone = phone

            def get_email(self) -> str:
                return self.email

        def get_details(self) -> str:
            return f"{self.name} - {self.student_id}"


class Application:
    class Settings:
        class Database:
            def __init__(self, host: str, port: int):
                self.host = host
                self.port = port

            def connection_string(self) -> str:
                return f"{self.host}:{self.port}"