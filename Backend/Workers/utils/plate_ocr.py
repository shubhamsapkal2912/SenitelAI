import easyocr
import re

class PlateOCR:

    def __init__(self):
        self.reader = easyocr.Reader(['en'])

    def extract(self, image):

        results = self.reader.readtext(image)

        if not results:
            return None

        text = results[0][1]

        text = text.replace(" ", "").upper()

        pattern = r"[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}"

        match = re.search(pattern, text)

        if match:
            return match.group()

        return text