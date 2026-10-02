"""Verify every discussion question against the supplied PDF, not just counts."""
import fitz
import re
from pathlib import Path

doc = fitz.open("attached_assets/ILP_Learner_Review_1790933771563.pdf")
source = []
for index, expected in [(1, 17), (3, 18), (5, 18)]:
    text = doc[index].get_text()
    # Term 2 starts with four instructional review-target bullets, not questions.
    if index == 3:
        text = text.split("Reflection", 1)[1]
    headings = "General Questions|Personal Development|Future Aspirations|Academic Progress|Reflection|Overcoming Barriers|Celebrating Success|Celebrating Your Success"
    questions = re.findall(r"●\s*(.*?)(?=●|\n(?:" + headings + r")\s*\n|\Z)", text, re.S)
    assert len(questions) == expected, (index, len(questions))
    source.extend(questions)
seed = Path("artifacts/api-server/src/lib/ilp-pdf-templates.ts").read_text()
implemented = re.findall(r'^\s*"([^"\n]+\?)",?$', seed, re.M)
def normalized(value):
    return re.sub(r"\s+", " ", value.replace("\u200b", "").replace("\xad", "")).strip()
assert [normalized(q) for q in source] == [normalized(q) for q in implemented]
print("All 53 PDF discussion questions match exactly in Terms 1–3.")