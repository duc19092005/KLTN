from fastapi import FastAPI

app = FastAPI()

patients = [
    {
        "id": 1,
        "patientCode": "BN0001",
        "fullName": "Nguyễn Văn Minh",
        "age": 32,
        "gender": "Nam",
        "phone": "0912345678",
        "address": "TP Hồ Chí Minh",
        "diagnosis": "Mụn trứng cá",
        "doctor": "BS Nguyễn Văn A",
        "status": "Đang điều trị"
    },
    {
        "id": 2,
        "patientCode": "BN0002",
        "fullName": "Trần Thị Lan",
        "age": 28,
        "gender": "Nữ",
        "phone": "0987654321",
        "address": "Hà Nội",
        "diagnosis": "Viêm da cơ địa",
        "doctor": "BS Trần Minh B",
        "status": "Đã khám"
    },
    {
        "id": 3,
        "patientCode": "BN0003",
        "fullName": "Lê Văn Hùng",
        "age": 45,
        "gender": "Nam",
        "phone": "0901112233",
        "address": "Đà Nẵng",
        "diagnosis": "Vảy nến",
        "doctor": "BS Lê Thị C",
        "status": "Tái khám"
    },
    {
        "id": 4,
        "patientCode": "BN0004",
        "fullName": "Phạm Thị Mai",
        "age": 36,
        "gender": "Nữ",
        "phone": "0933334444",
        "address": "Cần Thơ",
        "diagnosis": "Nấm da",
        "doctor": "BS Nguyễn Văn A",
        "status": "Đang điều trị"
    }
]

@app.get("/patients")
def get_patients():
    return {
        "total": len(patients),
        "data": patients
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001
    )